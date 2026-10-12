# Generated offline Mac recovery worker. No downloads performed by this program.
LDC_STANDALONE = True
"""Read-only local comparison of source history and independently retrieved recovery journals.

No network, database connection, file writes, or private record contents in output.
This is an initial-migration reconciliation, not approval for production cutover.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re

FORMAT = 'ldcooklog-supabase-relational-export'
TABLES = '''cooks events cook_equipment cook_evaluations cook_fireboard_sessions
cook_meat_pieces cook_methods cook_preparation cook_rubs cook_sauces equipment
fireboard_account_access fireboard_probe_roles fireboard_temperature_samples
locations rubs sauces weather'''.split()
RELATED = '''events cook_equipment cook_evaluations cook_fireboard_sessions
cook_meat_pieces cook_preparation cook_rubs cook_sauces fireboard_probe_roles weather'''.split()
NAME = re.compile(r'^(\d{16})-[a-f0-9-]{36}\.recovery\.json$', re.I)
DEVICE = re.compile(r'^[a-f0-9-]{36}$', re.I)
BASE = Path.home() / 'Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'


class AuditFailure(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise AuditFailure(message)


def distinct(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON keys; comparison stopped.')
        result[key] = value
    return result


def load(path):
    require(path.stat().st_size <= 250 * 1024 * 1024, 'File exceeds the audit size limit.')
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=distinct)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def source_archive(value):
    require(isinstance(value, dict) and value.get('format') == FORMAT and type(value.get('version')) is int and value['version'] == 1, 'Unsupported source export.')
    tables = value.get('tables')
    require(isinstance(tables, dict) and all(name in tables for name in TABLES), 'Source export is missing required tables.')
    for name, table in tables.items():
        require(re.fullmatch(r'[a-z][a-z0-9_]*', name) is not None, 'Invalid source table name.')
        columns, rows = table.get('columns'), table.get('rows')
        require(isinstance(columns, list) and bool(columns) and len(set(columns)) == len(columns) and all(isinstance(col, str) and re.fullmatch(r'[a-z][a-z0-9_]*', col) for col in columns), 'Invalid source columns.')
        require(isinstance(rows, list), 'Invalid source rows.')
        require(all(isinstance(row, dict) and set(row) == set(columns) and all(v is None or isinstance(v, str) for v in row.values()) for row in rows), 'Invalid source field values.')
    body = dict(format=FORMAT, version=1, createdAt=value['createdAt'], tables={name: tables[name] for name in sorted(tables)})
    require(hashlib.sha256(canonical(body).encode()).hexdigest() == value.get('sha256'), 'Source export checksum mismatch.')
    return value


def snapshot(path):
    match = NAME.fullmatch(path.name)
    require(match is not None, 'Invalid recovery filename.')
    envelope = load(path)
    require(envelope.get('format') == 'ldcooklog-recovery' and type(envelope.get('version')) is int and envelope['version'] == 1, 'Unsupported recovery envelope.')
    payload = envelope.get('payload')
    require(isinstance(payload, str) and hashlib.sha256(payload.encode()).hexdigest() == envelope.get('sha256'), 'Recovery checksum mismatch.')
    body = json.loads(payload, object_pairs_hook=distinct)
    require(type(body.get('revision')) is int and 1 <= body['revision'] <= 9007199254740991 and body['revision'] == int(match[1]) and body.get('version') == 1, 'Recovery revision mismatch.')
    iso(body['createdAt'])
    state = body.get('state')
    require(isinstance(state, dict) and isinstance(state.get('records'), list) and isinstance(state.get('relationalArchives'), list), 'Recovery collections missing.')
    return body


def latest_journals(root):
    require(root.is_dir(), 'Recovery folder has not reached this Mac.')
    latest = []
    for device in sorted(root.iterdir()):
        if not device.is_dir() or not DEVICE.fullmatch(device.name):
            continue
        files = sorted(p for p in device.iterdir() if NAME.fullmatch(p.name))
        if not files:
            continue
        revisions = [int(NAME.fullmatch(p.name)[1]) for p in files]
        require(len(set(revisions)) == len(revisions), 'Conflicting recovery revisions; comparison stopped.')
        # Check every retained copy. Never silently select an older healthy copy.
        checked = [snapshot(p) for p in files]
        latest.append(checked[-1])
    require(bool(latest), 'No recovery journal is readable on this Mac yet.')
    return latest


def iso(value):
    require(isinstance(value, str), 'Source timestamp missing.')
    at = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    require(at.tzinfo is not None, 'Timestamp lacks timezone; manual review required.')
    return at.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def same_rows(left, right):
    # Duplicate multiplicities matter, but JSON key order and row order do not.
    encode = lambda rows: Counter(json.dumps(row, sort_keys=True, ensure_ascii=False, allow_nan=False) for row in rows)
    return encode(left) == encode(right)


def reconcile(source, body):
    state, tables = body['state'], source['tables']
    matching = [item for item in state['relationalArchives'] if item.get('sha256') == source['sha256']]
    require(len(matching) == 1, 'Expected preserved source archive missing or duplicated.')
    source_archive(matching[0])
    require(matching[0] == source, 'Preserved source archive differs from the private export.')
    records = state['records']
    ids = [row['id'] for row in records]
    require(all(isinstance(i, str) and i for i in ids) and len(set(ids)) == len(ids), 'Duplicate or invalid recovery cook IDs.')
    by_id = {row['id']: row for row in records}
    source_ids = [row['id'] for row in tables['cooks']['rows']]
    require(len(set(source_ids)) == len(source_ids) and all(i in by_id for i in source_ids), 'Source cook IDs missing or duplicated.')
    source_events = source_readings = source_sessions = 0
    for row in tables['cooks']['rows']:
        cook = by_id[row['id']]
        require(cook.get('legacy', {}).get('cook') == row, 'Original cook fields changed or missing.')
        related = cook.get('legacy', {}).get('related', {})
        for name in RELATED:
            expected = [r for r in tables[name]['rows'] if r.get('cook_id') == row['id']]
            require(same_rows(related.get(name, []), expected), 'Preserved per-cook source details differ.')
        lookups = cook.get('legacy', {}).get('lookups', {})
        for name, field in [('locations', 'location_id'), ('cook_methods', 'cook_method_id')]:
            expected = [r for r in tables[name]['rows'] if row.get(field) and r.get('id') == row[field]]
            require(same_rows(lookups.get(name, []), expected), 'Converted lookup details differ.')
        for name, links, field in [('equipment', 'cook_equipment', 'equipment_id'), ('rubs', 'cook_rubs', 'rub_id'), ('sauces', 'cook_sauces', 'sauce_id')]:
            keys = {r[field] for r in related[links] if r.get(field)}
            expected = [r for r in tables[name]['rows'] if r.get('id') in keys]
            require(same_rows(lookups.get(name, []), expected), 'Converted equipment/rub/sauce details differ.')
        sessions = {r['id'] for r in related['cook_fireboard_sessions']}
        samples = [r for r in tables['fireboard_temperature_samples']['rows'] if r.get('cook_fireboard_session_id') in sessions]
        require(same_rows(related.get('fireboard_temperature_samples', []), samples), 'Preserved raw temperature samples differ.')
        expected_events = [dict(at=iso(e['event_time']), type=e.get('event_type') or 'Event', note=e.get('note') or '', legacyId=e.get('id') or None) for e in related['events']]
        require(same_rows(cook.get('events', []), expected_events), 'Converted event IDs, times, types or notes differ.')
        expected_readings = []
        for reading in samples:
            value = float(reading['temperature_value'])
            require(math.isfinite(value), 'Nonfinite source temperature; comparison stopped.')
            unit = 'C' if reading.get('degree_type') in ('1', 'C') else 'F' if reading.get('degree_type') in ('2', 'F') else 'unknown'
            channel = reading.get('channel_label') or 'Channel ' + (reading.get('channel_index') or '?')
            expected_readings.append(dict(at=iso(reading['observed_at']), value=value, channel=channel, unit=unit,
                legacyId=reading.get('id') or None, sessionId=reading['cook_fireboard_session_id'],
                deviceUUID=reading.get('device_uuid') or None, channelId=reading.get('channel_index') or reading.get('channel_id') or '?'))
        # Normalize numeric spelling: Python 225.0 and JS 225 have equal values.
        actual_readings = [dict(r, value=float(r['value'])) for r in cook.get('temperatures', [])]
        require(all(type(r.get('value')) in (int, float) and math.isfinite(r['value']) for r in cook.get('temperatures', [])), 'Invalid converted numeric temperatures.')
        require(same_rows(actual_readings, expected_readings), 'Converted reading IDs, timestamps, values, units or probe identities differ.')
        require(cook.get('food') == (row.get('food') or row.get('cook_id') or 'Unnamed cook') and cook.get('notes') == (row.get('notes') or ''), 'Converted food or notes differ.')
        require(cook.get('startedAt') == iso(row.get('start_time') or row.get('created_at')) and cook.get('finishedAt') == (iso(row['finish_time']) if row.get('finish_time') else None), 'Converted cook times differ.')
        phase = 'Finished' if row.get('finish_time') or row.get('phase') == 'Finished' else {'Setup': 'Preparation', 'Cooking': 'Cooking', 'Rest': 'Resting', 'Keep Warm': 'Keeping Warm'}.get(row.get('phase'), 'Cooking')
        require(cook.get('phase') == phase, 'Converted cook phase differs.')
        require(cook.get('source') == 'Supabase historical migration' and cook.get('isTestCook') == ('[TEST COOK: EXCLUDE FROM ANALYSIS]' in (row.get('notes') or '')), 'Converted origin or test-cook marker differs.')
        smoker = re.search(r'Smoker: (Traeger Ironwood 885|Traeger Pro|Weber 22" Kettle)', row.get('notes') or '')
        require(cook.get('cooker') == (row.get('smoker') or row.get('cooker') or (smoker.group(1) if smoker else None) or 'Not recorded'), 'Converted cooker differs.')
        source_events += len(expected_events)
        source_readings += len(expected_readings)
        source_sessions += len(sessions)
    require(source_events == len(tables['events']['rows']) and source_readings == len(tables['fireboard_temperature_samples']['rows']) and source_sessions == len(tables['cook_fireboard_sessions']['rows']), 'Source event/session/reading relationships are incomplete.')
    return dict(revision=body['revision'], sourceCooks=len(source_ids), extraCooks=len(records)-len(source_ids), events=source_events,
        readings=source_readings, sessions=source_sessions, tables=len(tables))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-export', type=Path, required=True)
    parser.add_argument('--working-root', type=Path, default=BASE / 'LDCookLog-2-Development-Recovery')
    parser.add_argument('--restored-root', type=Path, default=BASE / 'LDCookLog-2-Restore-Check-Recovery')
    args = parser.parse_args()
    try:
        source = source_archive(load(args.source_export))
        for label, root in [('Working', args.working_root), ('Restored trial', args.restored_root)]:
            for index, body in enumerate(latest_journals(root), 1):
                report = reconcile(source, body)
                print(f'{label} device {index}: SOURCE MATCH PASS; revision {report["revision"]}; {report["sourceCooks"]} source cooks; {report["extraCooks"]} extra cooks; {report["events"]} source events; {report["sessions"]} sessions; {report["readings"]} readings; all {report["tables"]} tables exact.')
    except AuditFailure as error:
        print('NOT RECONCILED:', error)
        print('No files changed. Keep the original PostgreSQL backup and report this message.')
        return 1
    except (OSError, ValueError, TypeError, AttributeError, KeyError, OverflowError):
        # Raw exceptions may contain private paths, record text or field values.
        print('NOT RECONCILED: files are unreadable or data needs review. No files changed.')
        return 1
    print('FULL SOURCE RECONCILIATION PASS: both independently readable recovery journals preserve the private source history.')
    print('No files changed or uploaded. Reinstall/new-device recovery, feature acceptance and backup operations still require verification.')
    return 0




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


def protect(source, destination, max_bytes=MAX_BYTES, scheduled=False):
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
    status = dict(format='ldcooklog-mac-recovery-status', version=1, checkedAt=datetime.now(timezone.utc).isoformat(), healthy=True, trigger='scheduled' if scheduled else 'manual', copies=reports,
                  message='Independent Mac copies verified. iCloud upload API status remains unconfirmed.')
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


def show_status(destination):
    attempt = json.loads((destination / 'last-attempt.json').read_text())
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(attempt['checkedAt'])).total_seconds()
    require(-300 <= age <= 900, 'Last Mac check is stale; keep the Mac awake and check the worker.')
    require(attempt.get('healthy') is True, 'Most recent Mac backup attempt failed; check the controlled worker log.')
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
    parser.add_argument('--icloud-root', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--destination', type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()
    try:
        if args.remove:
            remove()
            return 0
        if args.status:
            show_status(args.destination)
            return 0
        if args.install:
            require(args.icloud_root == DEFAULT_SOURCE and args.destination == DEFAULT_DESTINATION, 'Install uses the standard folders; custom paths are only for individual checks.')
        status = install() if args.install else protect(args.icloud_root, args.destination, scheduled=args.scheduled)
    except (AuditFailure, OSError, ValueError, TypeError, AttributeError, KeyError, OverflowError) as error:
        message = str(error) if isinstance(error, AuditFailure) else 'Files unavailable or data needs review.'
        # Do not replace a previous success receipt with another success on failure.
        destination = DEFAULT_DESTINATION if args.install else args.destination
        if not args.status and destination.is_dir() and not destination.is_symlink():
            try:
                atomic_write(destination / 'last-attempt.json', canonical(dict(healthy=False, trigger='scheduled' if args.scheduled else 'manual', checkedAt=datetime.now(timezone.utc).isoformat(), message=message)).encode())
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
