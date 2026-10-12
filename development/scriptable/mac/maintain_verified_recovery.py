"""Copy verified iCloud recovery bytes to private Mac storage; optional user LaunchAgent."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
from reconcile_private_history import AuditFailure, BASE, DEVICE, NAME, canonical, latest_journals, require, snapshot, source_archive, iso

LABEL = 'com.ldcooklog.verified-recovery'
MAC_HOME = Path.home() / 'Library/Application Support/LDCookLog'
DEFAULT_SOURCE = BASE / 'LDCookLog-2-Development-Recovery'
DEFAULT_DESTINATION = MAC_HOME / 'Verified Recovery'
MAX_BYTES = 1024 * 1024 * 1024
STAGES = {
    'starting': 'starting the recovery check',
    'read_icloud': 'reading iCloud recovery snapshots',
    'validate_state': 'validating current cooking data',
    'read_source_bytes': 'retrieving selected snapshot bytes',
    'prepare_destination': 'preparing independent Mac storage',
    'read_existing_copy': 'checking an existing independent copy',
    'publish_copy': 'publishing a new independent copy',
    'verify_copy': 'reading back the independent copy',
    'write_receipt': 'writing backup-status metadata',
    'prepare_agent': 'preparing the scheduled helper',
    'register_agent': 'registering the scheduled helper',
    'read_status': 'reading scheduled backup status',
}
CURRENT_STAGE = 'starting'
ERROR_TYPES = {'AuditFailure', 'PermissionError', 'FileNotFoundError', 'NotADirectoryError',
               'IsADirectoryError', 'BlockingIOError', 'OSError', 'JSONDecodeError',
               'UnicodeDecodeError', 'UnicodeEncodeError', 'ValueError', 'TypeError',
               'AttributeError', 'KeyError', 'OverflowError'}


def stage(value):
    global CURRENT_STAGE
    require(value in STAGES, 'Unknown recovery operation.')
    CURRENT_STAGE = value


def error_details(error):
    # Exception strings/args/filenames can contain private data: never retain them.
    name = type(error).__name__
    result = dict(stage=CURRENT_STAGE, errorType=name if name in ERROR_TYPES else 'Error')
    if isinstance(error, OSError) and type(error.errno) is int:
        result['errno'] = error.errno
    return result


def format_details(value):
    if not isinstance(value, dict):
        return 'operation details were not recorded by the older helper'
    operation = STAGES.get(value.get('stage'), 'unknown operation')
    name = value.get('errorType')
    name = name if name in ERROR_TYPES else 'Error'
    errno = value.get('errno')
    return operation + ' / ' + name + (f' / errno {errno}' if type(errno) is int else '')


def private_directory(path):
    require(not path.is_symlink(), 'Managed destination is a symbolic link; stopped.')
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path, 0o700)


def atomic_write(path, raw):
    require(not path.is_symlink(), 'Managed status/configuration is a symbolic link; stopped.')
    fd, temporary = tempfile.mkstemp(prefix='.ldcooklog-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def validate_current(body):
    records, archives = body['state']['records'], body['state']['relationalArchives']
    ids = set()
    events = readings = 0
    for cook in records:
        require(isinstance(cook, dict) and isinstance(cook.get('id'), str) and bool(cook['id'].strip()) and len(cook['id']) <= 160 and cook['id'] not in ids, 'Invalid or conflicting current cook IDs.')
        ids.add(cook['id'])
        require(isinstance(cook.get('food'), str) and len(cook['food']) <= 300 and isinstance(cook.get('cooker'), str) and len(cook['cooker']) <= 300, 'Current cook labels are invalid.')
        iso(cook['startedAt'])
        if cook.get('finishedAt') is not None:
            iso(cook['finishedAt'])
        require(isinstance(cook.get('events'), list) and isinstance(cook.get('temperatures'), list), 'Current cook series are missing.')
        require(len(cook['events']) <= 200000 and len(cook['temperatures']) <= 500000, 'Current cook series exceed supported limits.')
        for event in cook['events']:
            iso(event['at'])
            require(isinstance(event.get('type'), str) and isinstance(event.get('note'), str), 'Current event is invalid.')
        for reading in cook['temperatures']:
            iso(reading['at'])
            require(type(reading.get('value')) in (int, float) and math.isfinite(reading['value']) and isinstance(reading.get('channel'), str), 'Current temperature reading is invalid.')
        events += len(cook['events'])
        readings += len(cook['temperatures'])
    hashes = set()
    for archive in archives:
        source_archive(archive)
        require(archive['sha256'] not in hashes, 'Duplicate preserved source archive.')
        hashes.add(archive['sha256'])
        require(all(row['id'] in ids for row in archive['tables']['cooks']['rows']), 'Current journal omits a preserved source cook.')
    return dict(cooks=len(records), events=events, readings=readings, archives=len(archives))


def protect(source, destination, max_bytes=MAX_BYTES, scheduled=False):
    # Validate all retained source snapshots and reject a bad newest copy.
    # A source failure occurs before destination creation or copying.
    stage('read_icloud')
    latest_journals(source)
    stage('prepare_destination')
    require(source.resolve() != destination.resolve() and source.resolve() not in destination.resolve().parents and destination.resolve() not in source.resolve().parents, 'Source and destination must be separate folders.')
    for cloud_folder in (Path.home() / 'Library/Mobile Documents', Path.home() / 'Library/CloudStorage'):
        require(destination.resolve() != cloud_folder.resolve() and cloud_folder.resolve() not in destination.resolve().parents, 'Independent destination must be outside cloud storage.')
    if destination == DEFAULT_DESTINATION:
        private_directory(MAC_HOME)
    private_directory(destination)
    existing_size = sum(p.stat().st_size for p in destination.rglob('*.recovery.json') if p.is_file())
    reports = []
    for device in sorted(source.iterdir()):
        if not device.is_dir() or not DEVICE.fullmatch(device.name):
            continue
        files = sorted(p for p in device.iterdir() if NAME.fullmatch(p.name))
        if not files:
            continue
        selected = files[-1]
        stage('read_icloud')
        body = snapshot(selected)
        stage('validate_state')
        counts = validate_current(body)
        stage('read_source_bytes')
        raw = selected.read_bytes()
        # Reject a source changed between validation and retrieval.
        parsed = json.loads(raw)
        require(json.loads(parsed['payload']) == body and hashlib.sha256(parsed['payload'].encode()).hexdigest() == parsed['sha256'], 'Source changed during independent copying.')
        folder = destination / device.name
        stage('prepare_destination')
        private_directory(folder)
        target = folder / selected.name
        require(not target.is_symlink(), 'Existing verified copy is a symbolic link; stopped.')
        if target.exists():
            stage('read_existing_copy')
            require(target.read_bytes() == raw, 'Existing verified Mac copy differs; no copy overwritten.')
        else:
            require(existing_size + len(raw) <= max_bytes, 'Verified Mac copies reached the size limit; no copies deleted. Retention review required.')
            stage('publish_copy')
            fd, temporary = tempfile.mkstemp(prefix='.ldcooklog-', dir=folder)
            try:
                with os.fdopen(fd, 'wb') as handle:
                    handle.write(raw)
                    handle.flush()
                    os.fsync(handle.fileno())
                # Exclusive immutable publication. A collision never overwrites.
                try:
                    os.link(temporary, target)
                except FileExistsError:
                    require(target.read_bytes() == raw, 'Concurrent Mac copy differs; no copy overwritten.')
            finally:
                os.unlink(temporary)
            existing_size += len(raw)
        stage('verify_copy')
        require(target.read_bytes() == raw, 'Independent Mac copy readback failed.')
        require(snapshot(target) == body, 'Independent Mac copy validation failed.')
        reports.append(dict(revision=body['revision'], sha256=parsed['sha256'], snapshot=str(target.relative_to(destination)), **counts))
    require(bool(reports), 'No current recovery copy was protected.')
    status = dict(format='ldcooklog-mac-recovery-status', version=1, checkedAt=datetime.now(timezone.utc).isoformat(), healthy=True, trigger='scheduled' if scheduled else 'manual', copies=reports,
                  message='Independent Mac copies verified. iCloud upload API status remains unconfirmed.')
    stage('write_receipt')
    atomic_write(destination / 'status.json', canonical(status).encode())
    atomic_write(destination / 'last-attempt.json', canonical(status).encode())
    return status


def agent_plist(program, executable, destination):
    return dict(Label=LABEL, ProgramArguments=[str(executable), str(program), '--scheduled'], StartInterval=300, RunAtLoad=True,
                ProcessType='Background', Umask=0o077, StandardOutPath=str(destination.parent / 'recovery-worker.log'),
                StandardErrorPath=str(destination.parent / 'recovery-worker-error.log'))


def owned_agent(path, programs):
    if not path.exists():
        return False
    require(not path.is_symlink(), 'Agent configuration is a symbolic link; stopped.')
    value = plistlib.loads(path.read_bytes())
    arguments = value.get('ProgramArguments', [])
    require(value.get('Label') == LABEL and len(arguments) in (2, 3) and (len(arguments) == 2 or arguments[2] == '--scheduled') and Path(arguments[1]).parent == programs, 'An unrelated agent configuration exists; left unchanged.')
    return True


def install():
    require(sys.platform == 'darwin' and os.geteuid() != 0, 'Install from Terminal on your Mac without sudo.')
    require(globals().get('LDC_STANDALONE') is True, 'Use the generated standalone Mac recovery installer.')
    # Prove a real independent copy before configuring periodic execution.
    status = protect(DEFAULT_SOURCE, DEFAULT_DESTINATION)
    stage('prepare_agent')
    private_directory(MAC_HOME)
    programs = MAC_HOME / 'Programs'
    private_directory(programs)
    raw = Path(__file__).read_bytes()
    program = programs / (hashlib.sha256(raw).hexdigest() + '.py')
    if program.exists():
        require(not program.is_symlink() and program.read_bytes() == raw, 'Installed program bytes differ; stopped.')
    else:
        atomic_write(program, raw)
    agents = Path.home() / 'Library/LaunchAgents'
    agents.mkdir(parents=True, exist_ok=True)
    plist = agents / (LABEL + '.plist')
    previous = plist.read_bytes() if owned_agent(plist, programs) else None
    domain = 'gui/' + str(os.getuid())
    for name in ('recovery-worker.log', 'recovery-worker-error.log'):
        path = MAC_HOME / name
        require(not path.is_symlink(), 'Managed log is a symbolic link; stopped.')
        if not path.exists():
            atomic_write(path, b'')
        os.chmod(path, 0o600)
    if previous:
        subprocess.run(['launchctl', 'bootout', domain + '/' + LABEL], capture_output=True)
    atomic_write(plist, plistlib.dumps(agent_plist(program, Path(sys.executable).resolve(), DEFAULT_DESTINATION)))
    stage('register_agent')
    result = subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], capture_output=True)
    if result.returncode:
        if previous:
            atomic_write(plist, previous)
            subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], capture_output=True)
        else:
            plist.unlink()
        raise AuditFailure('Mac agent could not start. Verified copies kept; installation not accepted.')
    return status


def remove():
    require(sys.platform == 'darwin' and os.geteuid() != 0, 'Remove from your Mac without sudo.')
    plist = Path.home() / 'Library/LaunchAgents' / (LABEL + '.plist')
    if owned_agent(plist, MAC_HOME / 'Programs'):
        subprocess.run(['launchctl', 'bootout', 'gui/' + str(os.getuid()) + '/' + LABEL], capture_output=True)
        plist.unlink()
    print('Automatic Mac copying stopped. All verified recovery copies and cooking files were kept.')


def show_status(destination):
    stage('read_status')
    attempt = json.loads((destination / 'last-attempt.json').read_text())
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(attempt['checkedAt'])).total_seconds()
    require(-300 <= age <= 900, 'Last Mac check is stale; keep the Mac awake and check the worker.')
    require(attempt.get('healthy') is True, 'Most recent Mac backup attempt failed: ' + format_details(attempt.get('details')) + '.')
    require(attempt.get('trigger') == 'scheduled', 'Only manual copying is verified so far; scheduled execution is not yet confirmed.')
    if sys.platform == 'darwin':
        result = subprocess.run(['launchctl', 'print', 'gui/' + str(os.getuid()) + '/' + LABEL], capture_output=True)
        require(result.returncode == 0, 'Automatic agent is not registered.')
    for index, report in enumerate(attempt['copies'], 1):
        relative = Path(report['snapshot'])
        require(len(relative.parts) == 2 and DEVICE.fullmatch(relative.parts[0]) and NAME.fullmatch(relative.parts[1]), 'Managed receipt contains an invalid snapshot path.')
        require(not destination.is_symlink() and not (destination / relative.parts[0]).is_symlink() and not (destination / relative).is_symlink(), 'Independent copy location changed; verification stopped.')
        body = snapshot(destination / relative)
        counts = validate_current(body)
        envelope = json.loads((destination / relative).read_text())
        require(envelope['sha256'] == report['sha256'] and body['revision'] == report['revision'], 'Recorded independent copy differs from the verified receipt.')
        print(f'AUTOMATIC MAC CHECK PASS: device {index}; revision {body["revision"]}; {counts["cooks"]} cooks; {counts["events"]} events; {counts["readings"]} readings; {counts["archives"]} source archives.')
    print('RECENT SCHEDULED EXECUTION VERIFIED. Independent copies are readable; no cooking files changed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--install', action='store_true')
    mode.add_argument('--remove', action='store_true')
    mode.add_argument('--scheduled', action='store_true')
    mode.add_argument('--status', action='store_true')
    mode.add_argument('--diagnose', action='store_true', help='Read and validate iCloud recovery data from Terminal without copying or changing status.')
    parser.add_argument('--icloud-root', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--destination', type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()
    stage('starting')
    try:
        if args.remove:
            remove()
            return 0
        if args.status:
            show_status(args.destination)
            return 0
        if args.diagnose:
            stage('read_icloud')
            journals = latest_journals(args.icloud_root)
            stage('validate_state')
            for body in journals:
                validate_current(body)
            print(f'TERMINAL ICLOUD READ PASS: {len(journals)} current journal(s) readable and validated. No files changed.')
            return 0
        if args.install:
            require(args.icloud_root == DEFAULT_SOURCE and args.destination == DEFAULT_DESTINATION, 'Install uses the standard folders; custom paths are only for individual checks.')
        status = install() if args.install else protect(args.icloud_root, args.destination, scheduled=args.scheduled)
    except (AuditFailure, OSError, ValueError, TypeError, AttributeError, KeyError, OverflowError) as error:
        details = error_details(error)
        message = str(error) if isinstance(error, AuditFailure) else 'Files unavailable or data needs review: ' + format_details(details) + '.'
        # Do not replace a previous success receipt with another success on failure.
        destination = DEFAULT_DESTINATION if args.install else args.destination
        if not args.status and not args.diagnose and destination.is_dir() and not destination.is_symlink():
            try:
                atomic_write(destination / 'last-attempt.json', canonical(dict(healthy=False, trigger='scheduled' if args.scheduled else 'manual', checkedAt=datetime.now(timezone.utc).isoformat(), message=message, details=details)).encode())
            except (OSError, AuditFailure):
                pass
        print('NOT PROTECTED:', message)
        print('No source cooking files or existing verified copies were replaced or deleted.')
        return 1
    for index, report in enumerate(status['copies'], 1):
        print(f'MAC INDEPENDENT COPY PASS: device {index}; revision {report["revision"]}; {report["cooks"]} cooks; {report["events"]} events; {report["readings"]} readings; {report["archives"]} source archives.')
    if args.install:
        print('AUTOMATIC MAC RECOVERY INSTALLED: checks every five minutes while your Mac is awake and you are signed in.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
