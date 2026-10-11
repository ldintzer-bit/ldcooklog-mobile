"""Read-only iCloud transport/integrity check. Not a restore or full schema audit."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

NAME = re.compile(r'^(\d{16})-[a-f0-9-]{36}\.recovery\.json$', re.I)
DEVICE = re.compile(r'^[a-f0-9-]{36}$', re.I)
DEFAULT_ROOT = Path.home() / 'Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/LDCookLog-2-Development-Recovery'


def distinct_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate JSON key')
        value[key] = item
    return value


def inspect_snapshot(path):
    match = NAME.fullmatch(path.name)
    if not match:
        raise ValueError('Unsupported snapshot filename')
    envelope = json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=distinct_object)
    if envelope.get('format') != 'ldcooklog-recovery' or envelope.get('version') != 1:
        raise ValueError('Unsupported recovery envelope')
    payload = envelope.get('payload')
    if not isinstance(payload, str):
        raise ValueError('Missing recovery payload')
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    if digest != envelope.get('sha256'):
        raise ValueError('Recovery checksum mismatch')
    body = json.loads(payload, object_pairs_hook=distinct_object)
    revision = body.get('revision')
    if type(revision) is not int or not 1 <= revision <= 9007199254740991 or revision != int(match[1]) or body.get('version') != 1:
        raise ValueError('Recovery revision/version mismatch')
    at = datetime.fromisoformat(body.get('createdAt', '').replace('Z', '+00:00'))
    if at.tzinfo is None:
        raise ValueError('Recovery timestamp lacks timezone')
    state = body.get('state', {})
    records, archives = state.get('records'), state.get('relationalArchives')
    if not isinstance(records, list) or not isinstance(archives, list):
        raise ValueError('Missing recovery collections')
    events = readings = 0
    ids = set()
    for cook in records:
        if not isinstance(cook, dict) or not isinstance(cook.get('id'), str) or cook['id'] in ids:
            raise ValueError('Invalid or duplicate cook identity')
        ids.add(cook['id'])
        if not isinstance(cook.get('events'), list) or not isinstance(cook.get('temperatures'), list):
            raise ValueError('Missing cook events/readings')
        events += len(cook['events'])
        readings += len(cook['temperatures'])
    return dict(revision=revision, cooks=len(records), events=events, readings=readings, archives=len(archives))


def check_root(root):
    if not root.is_dir():
        raise ValueError('Recovery folder is not available on this Mac yet')
    devices = []
    for directory in sorted(root.iterdir()):
        if not directory.is_dir() or not DEVICE.fullmatch(directory.name):
            continue
        files = sorted(p for p in directory.iterdir() if NAME.fullmatch(p.name))
        if not files:
            continue
        revisions = [int(NAME.fullmatch(p.name)[1]) for p in files]
        if len(set(revisions)) != len(revisions):
            raise ValueError('Conflicting snapshot revisions; no recovery candidate chosen')
        checked = [inspect_snapshot(p) for p in files]
        devices.append(dict(snapshots=len(checked), latest=checked[-1]))
    if not devices:
        raise ValueError('No readable recovery snapshots found yet')
    return devices


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    args = parser.parse_args()
    try:
        devices = check_root(args.root)
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        print('NOT VERIFIED: recovery copies are missing, unreadable, damaged or conflicting.')
        print('No cooking files were changed. Check iCloud download status and report this result.')
        return 1
    print('MAC READ/CHECKSUM PASS: iCloud-folder recovery bytes are readable on this Mac.')
    for index, device in enumerate(devices, 1):
        latest = device['latest']
        print(f"Device {index}: {device['snapshots']} snapshots; latest revision {latest['revision']}; {latest['cooks']} cooks; {latest['events']} events; {latest['readings']} readings; {latest['archives']} source archives.")
    print('This proves Mac readability and checksum integrity, not full cooking schema validation or successful restoration.')
    print('A fresh-journal restore and private-history reconciliation are still required. No files were changed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
