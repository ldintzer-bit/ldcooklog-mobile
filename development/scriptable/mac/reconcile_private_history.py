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


def load(path, reader=None):
    if reader:
        # Injected cloud readers enforce the same limit while also handling
        # transient stat/read failures and native materialization requests.
        raw = reader(path)
    else:
        require(path.stat().st_size <= 250 * 1024 * 1024, 'File exceeds the audit size limit.')
        raw = path.read_text(encoding='utf-8')
    return json.loads(raw, object_pairs_hook=distinct)


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


def snapshot(path, reader=None):
    match = NAME.fullmatch(path.name)
    require(match is not None, 'Invalid recovery filename.')
    envelope = load(path, reader)
    require(envelope.get('format') == 'ldcooklog-recovery' and type(envelope.get('version')) is int and envelope['version'] == 1, 'Unsupported recovery envelope.')
    payload = envelope.get('payload')
    require(isinstance(payload, str) and hashlib.sha256(payload.encode()).hexdigest() == envelope.get('sha256'), 'Recovery checksum mismatch.')
    body = json.loads(payload, object_pairs_hook=distinct)
    require(type(body.get('revision')) is int and 1 <= body['revision'] <= 9007199254740991 and body['revision'] == int(match[1]) and body.get('version') == 1, 'Recovery revision mismatch.')
    iso(body['createdAt'])
    state = body.get('state')
    require(isinstance(state, dict) and isinstance(state.get('records'), list) and isinstance(state.get('relationalArchives'), list), 'Recovery collections missing.')
    return body


def latest_journals(root, reader=None):
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
        checked = [snapshot(p, reader) for p in files]
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


if __name__ == '__main__':
    raise SystemExit(main())
