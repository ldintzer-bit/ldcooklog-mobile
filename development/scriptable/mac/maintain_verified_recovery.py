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


def protect(source, destination, max_bytes=MAX_BYTES):
    # Validate all retained source snapshots and reject a bad newest copy.
    # A source failure occurs before destination creation or copying.
    latest_journals(source)
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
        body = snapshot(selected)
        counts = validate_current(body)
        raw = selected.read_bytes()
        # Reject a source changed between validation and retrieval.
        parsed = json.loads(raw)
        require(json.loads(parsed['payload']) == body and hashlib.sha256(parsed['payload'].encode()).hexdigest() == parsed['sha256'], 'Source changed during independent copying.')
        folder = destination / device.name
        private_directory(folder)
        target = folder / selected.name
        require(not target.is_symlink(), 'Existing verified copy is a symbolic link; stopped.')
        if target.exists():
            require(target.read_bytes() == raw, 'Existing verified Mac copy differs; no copy overwritten.')
        else:
            require(existing_size + len(raw) <= max_bytes, 'Verified Mac copies reached the size limit; no copies deleted. Retention review required.')
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
        require(target.read_bytes() == raw, 'Independent Mac copy readback failed.')
        require(snapshot(target) == body, 'Independent Mac copy validation failed.')
        reports.append(dict(revision=body['revision'], sha256=parsed['sha256'], snapshot=str(target.relative_to(destination)), **counts))
    require(bool(reports), 'No current recovery copy was protected.')
    status = dict(format='ldcooklog-mac-recovery-status', version=1, checkedAt=datetime.now(timezone.utc).isoformat(), healthy=True, copies=reports,
                  message='Independent Mac copies verified. iCloud upload API status remains unconfirmed.')
    atomic_write(destination / 'status.json', canonical(status).encode())
    atomic_write(destination / 'last-attempt.json', canonical(status).encode())
    return status


def agent_plist(program, executable, destination):
    return dict(Label=LABEL, ProgramArguments=[str(executable), str(program)], StartInterval=300, RunAtLoad=True,
                ProcessType='Background', Umask=0o077, StandardOutPath=str(destination.parent / 'recovery-worker.log'),
                StandardErrorPath=str(destination.parent / 'recovery-worker-error.log'))


def owned_agent(path, programs):
    if not path.exists():
        return False
    require(not path.is_symlink(), 'Agent configuration is a symbolic link; stopped.')
    value = plistlib.loads(path.read_bytes())
    arguments = value.get('ProgramArguments', [])
    require(value.get('Label') == LABEL and len(arguments) == 2 and Path(arguments[1]).parent == programs, 'An unrelated agent configuration exists; left unchanged.')
    return True


def install():
    require(sys.platform == 'darwin' and os.geteuid() != 0, 'Install from Terminal on your Mac without sudo.')
    require(globals().get('LDC_STANDALONE') is True, 'Use the generated standalone Mac recovery installer.')
    # Prove a real independent copy before configuring periodic execution.
    status = protect(DEFAULT_SOURCE, DEFAULT_DESTINATION)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--install', action='store_true')
    mode.add_argument('--remove', action='store_true')
    parser.add_argument('--icloud-root', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--destination', type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()
    try:
        if args.remove:
            remove()
            return 0
        if args.install:
            require(args.icloud_root == DEFAULT_SOURCE and args.destination == DEFAULT_DESTINATION, 'Install uses the standard folders; custom paths are only for individual checks.')
        status = install() if args.install else protect(args.icloud_root, args.destination)
    except (AuditFailure, OSError, ValueError, TypeError, AttributeError, KeyError, OverflowError) as error:
        message = str(error) if isinstance(error, AuditFailure) else 'Files unavailable or data needs review.'
        # Do not replace a previous success receipt with another success on failure.
        destination = DEFAULT_DESTINATION if args.install else args.destination
        if destination.is_dir() and not destination.is_symlink():
            try:
                atomic_write(destination / 'last-attempt.json', canonical(dict(healthy=False, checkedAt=datetime.now(timezone.utc).isoformat(), message=message)).encode())
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
