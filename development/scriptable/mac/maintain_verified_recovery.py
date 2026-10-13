"""Copy verified iCloud recovery bytes to private Mac storage; optional user LaunchAgent."""
import argparse
import errno
import fcntl
import shutil
import stat
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
import time
from reconcile_private_history import AuditFailure, BASE, DEVICE, NAME, canonical, latest_journals, require, snapshot, source_archive, iso

LABEL = 'com.ldcooklog.verified-recovery'
MAC_HOME = Path.home() / 'Library/Application Support/LDCookLog'
DEFAULT_SOURCE = BASE / 'LDCookLog-2-Development-Recovery'
DEFAULT_DESTINATION = MAC_HOME / 'Verified Recovery'
MAX_BYTES = 1024 * 1024 * 1024
STAGES = {
    'starting': 'starting the recovery check',
    'read_icloud': 'reading iCloud recovery snapshots',
    'download_icloud': 'requesting local iCloud recovery bytes',
    'validate_state': 'validating current cooking data',
    'read_source_bytes': 'retrieving selected snapshot bytes',
    'prepare_destination': 'preparing independent Mac storage',
    'read_existing_copy': 'checking an existing independent copy',
    'retention': 'checking backup retention and capacity',
    'publish_copy': 'publishing a new independent copy',
    'verify_copy': 'reading back the independent copy',
    'write_receipt': 'writing backup-status metadata',
    'publish_report': 'publishing independent-copy status to iCloud',
    'prepare_agent': 'preparing the scheduled helper',
    'register_agent': 'registering the scheduled helper',
    'read_status': 'reading scheduled backup status',
}
CURRENT_STAGE = 'starting'
READ_DEADLINE = None
DOWNLOAD_DETAILS = None
DOWNLOAD_REQUESTED = set()
CLOUD_RETRY_ERRNOS = {errno.EAGAIN, errno.EWOULDBLOCK, errno.EDEADLK}
DOWNLOAD_SCRIPT = """function run(argv) {
  ObjC.import('Foundation');
  try {
    var error = $();
    var url = $.NSURL.fileURLWithPath(argv[0]);
    var ok = $.NSFileManager.defaultManager.startDownloadingUbiquitousItemAtURLError(url, error);
    return JSON.stringify({requested: Boolean(ok), code: error.isNil() ? null : Number(error.code)});
  } catch (e) {
    return JSON.stringify({requested: false, bridgeFailure: true});
  }
}"""
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
        result['errnoName'] = 'EDEADLK' if error.errno == errno.EDEADLK else 'EAGAIN' if error.errno == errno.EAGAIN else errno.errorcode.get(error.errno, 'UNKNOWN')
    if DOWNLOAD_DETAILS is not None:
        result['download'] = DOWNLOAD_DETAILS
    return result


def format_details(value):
    if not isinstance(value, dict):
        return 'operation details were not recorded by the older helper'
    operation = STAGES.get(value.get('stage'), 'unknown operation')
    name = value.get('errorType')
    name = name if name in ERROR_TYPES else 'Error'
    error_number = value.get('errno')
    text = operation + ' / ' + name + (f' / errno {error_number}' if type(error_number) is int else '')
    symbolic = value.get('errnoName')
    if isinstance(symbolic, str) and symbolic in (set(errno.errorcode.values()) | {'EDEADLK', 'EAGAIN', 'EWOULDBLOCK'}):
        text += ' (' + symbolic + ')'
    download = value.get('download')
    if isinstance(download, dict):
        if type(download.get('code')) is int:
            text += f' / Foundation download code {download["code"]}'
        if download.get('bridgeFailure') is True:
            text += ' / native download bridge failed'
        if download.get('timeout') is True:
            text += ' / native download request timed out'
    return text


def request_icloud_download(path):
    if sys.platform != 'darwin':
        return dict(requested=False, unsupportedPlatform=True)
    try:
        # The pathname is an argument, never interpolated into code or a shell.
        # Foundation starts local materialization; no Finder/app UI is opened.
        result = subprocess.run(['/usr/bin/osascript', '-l', 'JavaScript', '-e', DOWNLOAD_SCRIPT, str(path)], capture_output=True, text=True, timeout=8)
    except subprocess.TimeoutExpired:
        return dict(requested=False, timeout=True)
    if result.returncode:
        return dict(requested=False, bridgeFailure=True)
    try:
        value = json.loads(result.stdout)
        safe = dict(requested=value.get('requested') is True)
        if type(value.get('code')) is int:
            safe['code'] = value['code']
        if value.get('bridgeFailure') is True:
            safe['bridgeFailure'] = True
        return safe
    except (ValueError, AttributeError):
        return dict(requested=False, bridgeFailure=True)


def read_icloud_bytes(path):
    global DOWNLOAD_DETAILS
    deadline = READ_DEADLINE if READ_DEADLINE is not None else time.monotonic() + 45
    delay = 0.5
    while True:
        try:
            require(path.stat().st_size <= 250 * 1024 * 1024, 'File exceeds the audit size limit.')
            raw = path.read_bytes()
            require(len(raw) <= 250 * 1024 * 1024, 'File exceeds the audit size limit.')
            return raw
        except OSError as error:
            if error.errno not in CLOUD_RETRY_ERRNOS:
                raise
            if time.monotonic() >= deadline:
                raise
            if path not in DOWNLOAD_REQUESTED:
                DOWNLOAD_REQUESTED.add(path)
                saved_stage = CURRENT_STAGE
                stage('download_icloud')
                try:
                    DOWNLOAD_DETAILS = request_icloud_download(path)
                finally:
                    stage(saved_stage)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise
            time.sleep(min(delay, remaining))
            delay = min(delay * 2, 4)


def read_icloud_text(path):
    return read_icloud_bytes(path).decode('utf-8')


def begin_cloud_read():
    global READ_DEADLINE, DOWNLOAD_DETAILS
    READ_DEADLINE = time.monotonic() + 45
    DOWNLOAD_DETAILS = None
    DOWNLOAD_REQUESTED.clear()


def publish_reports(source, status, failed=False):
    namespaces = {'LDCookLog-2-Development-Recovery': 'development', 'LDCookLog-2-Restore-Check-Recovery': 'restore-check'}
    namespace = namespaces.get(source.name)
    if namespace is None:
        return False  # Custom test/check sources never publish cloud metadata.
    folder = source.parent / 'LDCookLog-2-Mac-Verification' / namespace
    require(not folder.is_symlink() and not folder.parent.is_symlink(), 'Verification-report folder is a symbolic link; stopped.')
    folder.mkdir(parents=True, exist_ok=True)
    for copy in status['copies']:
        relative = Path(copy['snapshot'])
        require(len(relative.parts) == 2 and DEVICE.fullmatch(relative.parts[0]) and NAME.fullmatch(relative.parts[1]), 'Invalid report identity.')
        report = dict(format='ldcooklog-mac-copy-report', version=1, namespace=namespace, device=relative.parts[0],
            health='failed' if failed else 'verified', revision=copy['revision'], sha256=copy['sha256'],
            verifiedAt=status['checkedAt'], checkedAt=datetime.now(timezone.utc).isoformat(), trigger=status['trigger'])
        if not failed and 'capacity' in status:
            report['capacity'] = status['capacity']
        # Metadata only: no copy path, cooking data, record counts or errors.
        atomic_write(folder / (relative.parts[0] + '.json'), canonical(report).encode())
    return True


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


def retention_plan(items, max_bytes):
    """Keep first + newest three/device; prefer 30 recent and 12 monthly points.

    items have already been validated. Preserve a representative for every
    original source archive even when it no longer occurs in the newest state.
    Unknown files are never candidates. No deletion happens in planning.
    """
    require(type(max_bytes) is int and max_bytes > 0, 'Invalid size limit.')
    mandatory, preferred = set(), set()
    groups = {}
    for key, item in items.items():
        groups.setdefault(key.parts[0], []).append((key, item))
    for group in groups.values():
        group.sort(key=lambda row: row[1]['revision'])
        mandatory.add(group[0][0])
        mandatory.update(key for key, _ in group[-3:])
        preferred.update(key for key, _ in group[-30:])
        months, archives = set(), set()
        for key, item in reversed(group):
            month = item['createdAt'][:7]
            if month not in months and len(months) < 12:
                preferred.add(key)
                months.add(month)
            for sha in item['archives']:
                if sha not in archives:
                    mandatory.add(key)
                    archives.add(sha)
    keep = mandatory | preferred
    required_bytes = sum(items[key]['size'] for key in mandatory)
    require(required_bytes <= max_bytes, 'Required recovery points exceed the size limit; existing copies kept. Increase capacity before continuing.')
    total = sum(items[key]['size'] for key in keep)
    for key in sorted(keep - mandatory, key=lambda key: items[key]['createdAt']):
        if total <= max_bytes:
            break
        keep.remove(key)
        total -= items[key]['size']
    return set(items) - keep, total


def protect(source, destination, max_bytes=MAX_BYTES, scheduled=False):
    stage('read_icloud')
    begin_cloud_read()
    latest_journals(source, read_icloud_text)
    stage('prepare_destination')
    require(source.resolve() != destination.resolve() and source.resolve() not in destination.resolve().parents and destination.resolve() not in source.resolve().parents, 'Source and destination must be separate folders.')
    for cloud_folder in (Path.home() / 'Library/Mobile Documents', Path.home() / 'Library/CloudStorage'):
        require(destination.resolve() != cloud_folder.resolve() and cloud_folder.resolve() not in destination.resolve().parents, 'Independent destination must be outside cloud storage.')
    if destination == DEFAULT_DESTINATION:
        private_directory(MAC_HOME)
    private_directory(destination)
    # Serialize install/manual/scheduled runs before any copy or retention work.
    fd = os.open(destination / '.worker.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return protect_locked(source, destination, max_bytes, scheduled)
    finally:
        os.close(fd)


def protect_locked(source, destination, max_bytes, scheduled):
    items, pending, reports = {}, {}, []

    def item(path, raw, body):
        return dict(size=len(raw), revision=body['revision'], createdAt=body['createdAt'],
                    archives=[a['sha256'] for a in body['state']['relationalArchives']],
                    digest=hashlib.sha256(raw).hexdigest())

    stage('retention')
    for folder in destination.iterdir():
        if not DEVICE.fullmatch(folder.name):
            continue
        require(not folder.is_symlink() and folder.is_dir(), 'Managed device folder changed; retention stopped.')
        revisions = set()
        for path in folder.iterdir():
            if not NAME.fullmatch(path.name):
                continue
            require(not path.is_symlink() and path.is_file(), 'Managed recovery file changed; retention stopped.')
            raw = path.read_bytes()
            try:
                body = snapshot(path)
                validate_current(body)
            except (ValueError, TypeError, KeyError):
                raise AuditFailure('Existing Mac recovery data is invalid; retention stopped.') from None
            require(body['revision'] not in revisions, 'Conflicting Mac revisions; retention stopped.')
            revisions.add(body['revision'])
            items[path.relative_to(destination)] = item(path, raw, body)

    for device in sorted(source.iterdir()):
        if not device.is_dir() or not DEVICE.fullmatch(device.name):
            continue
        files = sorted(p for p in device.iterdir() if NAME.fullmatch(p.name))
        if not files:
            continue
        selected = files[-1]
        stage('read_icloud')
        body = snapshot(selected, read_icloud_text)
        stage('validate_state')
        counts = validate_current(body)
        stage('read_source_bytes')
        raw = read_icloud_bytes(selected)
        parsed = json.loads(raw)
        require(json.loads(parsed['payload']) == body and hashlib.sha256(parsed['payload'].encode()).hexdigest() == parsed['sha256'], 'Source changed during independent copying.')
        relative = Path(device.name) / selected.name
        folder = destination / device.name
        private_directory(folder)
        target = destination / relative
        require(not target.is_symlink(), 'Existing verified copy is a symbolic link; stopped.')
        if relative in items:
            require(items[relative]['digest'] == hashlib.sha256(raw).hexdigest(), 'Existing verified Mac copy differs; no copy overwritten.')
        else:
            require(all(key.parts[0] != device.name or value['revision'] < body['revision'] for key, value in items.items()), 'Source revision is older than or conflicts with independent history; copies kept.')
            items[relative] = item(target, raw, body)
            pending[relative] = (raw, body)
        reports.append(dict(revision=body['revision'], sha256=parsed['sha256'], snapshot=str(relative), **counts))
    require(bool(reports), 'No current recovery copy was protected.')
    stage('retention')
    remove, retained_bytes = retention_plan(items, max_bytes)
    # Never discard a just-selected source or any copy from a device absent today.
    require(not any(Path(report['snapshot']) in remove for report in reports), 'Current source conflicts with retention; copies kept.')
    active_devices = {Path(report['snapshot']).parts[0] for report in reports}
    remove = {key for key in remove if key.parts[0] in active_devices}
    retained_bytes = sum(value['size'] for key, value in items.items() if key not in remove)
    require(retained_bytes <= max_bytes, 'Unavailable-device copies exceed the size limit; copies kept.')
    additional = sum(len(raw) for raw, _ in pending.values())
    require(shutil.disk_usage(destination).free >= additional + 32 * 1024 * 1024, 'Not enough free Mac disk space; existing copies kept.')
    for relative, (raw, body) in pending.items():
        target = destination / relative
        stage('publish_copy')
        fd, temporary = tempfile.mkstemp(prefix='.ldcooklog-', dir=target.parent)
        try:
            with os.fdopen(fd, 'wb') as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.link(temporary, target)
            directory_fd = os.open(target.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            os.unlink(temporary)
        stage('verify_copy')
        require(target.read_bytes() == raw and snapshot(target) == body, 'Independent Mac copy readback failed.')
    # Preflight all bytes again before the first deletion. On partial failure,
    # first/newest three/archive representatives still remain recoverable.
    stage('retention')
    for relative, value in items.items():
        path = destination / relative
        require(not path.is_symlink() and not path.parent.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest() == value['digest'], 'Mac copy changed during retention; deletion stopped.')
    for relative in sorted(remove):
        (destination / relative).unlink()
    capacity = dict(bytes=retained_bytes, limit=max_bytes, copies=len(items)-len(remove), pruned=len(remove), warning=retained_bytes >= max_bytes * .8)
    status = dict(format='ldcooklog-mac-recovery-status', version=1, checkedAt=datetime.now(timezone.utc).isoformat(), healthy=True, trigger='scheduled' if scheduled else 'manual', copies=reports, capacity=capacity,
                  message='Independent Mac copies verified. iCloud upload API status remains unconfirmed.')
    stage('write_receipt')
    atomic_write(destination / 'status.json', canonical(status).encode())
    atomic_write(destination / 'last-attempt.json', canonical(status).encode())
    stage('publish_report')
    try:
        status['reportPublished'] = publish_reports(source, status)
    except (AuditFailure, OSError, ValueError, TypeError, AttributeError, KeyError):
        status['reportPublished'] = False
    return status


NOTICE_TEXT = {
    'failed': ('LDCookLog backup needs attention', 'The latest scheduled Mac backup check failed. Required recovery points are kept. Open LDCookLog and check Recovery protection.'),
    'recovered': ('LDCookLog backup resumed', 'A scheduled Mac check has verified the current independent recovery copy again.'),
    'capacity': ('LDCookLog backup storage warning', 'Managed recovery copies use at least 80 percent of their storage budget. Check Recovery protection before storage fills.')
}


def send_local_notice(kind):
    if sys.platform != 'darwin' or kind not in NOTICE_TEXT:
        return False
    title, message = NOTICE_TEXT[kind]
    # Only fixed application text, never paths, cook details or exception text.
    script = 'display notification ' + json.dumps(message) + ' with title ' + json.dumps(title)
    try:
        result = subprocess.run(['/usr/bin/osascript', '-e', script], capture_output=True, timeout=8)
        return result.returncode == 0  # Request accepted, not proof it was shown.
    except (OSError, subprocess.TimeoutExpired):
        return False


def trim_worker_logs(home, maximum=1024*1024, retained=256*1024):
    require(not home.is_symlink(), 'Managed log folder changed; maintenance stopped.')
    for name in ('recovery-worker.log', 'recovery-worker-error.log'):
        path = home / name
        if not path.exists():
            continue
        fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
        try:
            info = os.fstat(fd)
            require(stat.S_ISREG(info.st_mode), 'Managed log is not a regular file; maintenance stopped.')
            if info.st_size <= maximum:
                continue
            os.lseek(fd, -min(retained,info.st_size), os.SEEK_END)
            tail = os.read(fd, retained)
            atomic_write(home / (name + '.previous'), tail)
            # Preserve the current inode used by launchd's stdout/stderr handle.
            os.ftruncate(fd, 0)
            os.fsync(fd)
        finally:
            os.close(fd)


def operational_maintenance(healthy, capacity=None, home=MAC_HOME, now=None):
    # Optional operational metadata/alerts can never negate a verified backup.
    if not home.is_dir() or home.is_symlink():
        return
    now = time.time() if now is None else now
    try:
        fd = os.open(home / '.maintenance.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            trim_worker_logs(home)
            path = home / 'notification-status.json'
            previous = {}
            if path.exists():
                require(not path.is_symlink() and path.stat().st_size <= 4096, 'Managed notification state changed.')
                try:
                    previous = json.loads(path.read_text())
                    require(isinstance(previous,dict), 'Invalid notice state.')
                except (ValueError,TypeError):
                    previous = {}
            def due(key,interval):
                at = previous.get(key)
                return type(at) not in (int,float) or not math.isfinite(at) or at>now+300 or now-at>=interval
            failed = not healthy
            high = bool(healthy and capacity and capacity.get('warning') is True)
            notices = []
            if failed and (previous.get('failed') is not True or due('failureAt',4*3600)):
                notices.append(('failed','failureAt'))
            elif healthy and previous.get('failed') is True:
                notices.append(('recovered','recoveryAt'))
            if high and (previous.get('highCapacity') is not True or due('capacityAt',24*3600)):
                notices.append(('capacity','capacityAt'))
            state = {key:previous[key] for key in ('failureAt','recoveryAt','capacityAt') if type(previous.get(key)) in (int,float) and math.isfinite(previous[key])}
            state.update(failed=failed,highCapacity=high,checkedAt=now)
            for kind,key in notices:
                state[key] = now
                state['lastRequestAccepted'] = send_local_notice(kind)
            atomic_write(path, canonical(state).encode())
        finally:
            os.close(fd)
    except (AuditFailure,OSError,ValueError,TypeError,AttributeError,KeyError):
        pass


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
    capacity = attempt.get('capacity')
    if capacity:
        print(f'MAC STORAGE: {capacity["bytes"] // (1024*1024)} MiB of {capacity["limit"] // (1024*1024)} MiB; {capacity["copies"]} retained copies.' + (' CAPACITY WARNING: over 80%.' if capacity['warning'] else ''))
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
    standard_scheduled = args.scheduled and args.icloud_root == DEFAULT_SOURCE and args.destination == DEFAULT_DESTINATION
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
            begin_cloud_read()
            journals = latest_journals(args.icloud_root, read_icloud_text)
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
                try:
                    previous = json.loads((destination / 'status.json').read_text())
                    publish_reports(args.icloud_root, previous, failed=True)
                except (AuditFailure, OSError, ValueError, TypeError, AttributeError, KeyError):
                    pass
            except (OSError, AuditFailure):
                pass
        if standard_scheduled:
            operational_maintenance(False)
        print('NOT PROTECTED:', message)
        print('Source cooking files were not changed. Retention may have removed only eligible older Mac copies after verified replacement; required recovery points are kept.')
        return 1
    if standard_scheduled:
        operational_maintenance(True, status.get('capacity'))
    for index, report in enumerate(status['copies'], 1):
        print(f'MAC INDEPENDENT COPY PASS: device {index}; revision {report["revision"]}; {report["cooks"]} cooks; {report["events"]} events; {report["readings"]} readings; {report["archives"]} source archives.')
    if args.install:
        print('AUTOMATIC MAC RECOVERY INSTALLED: checks every five minutes while your Mac is awake and you are signed in.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
