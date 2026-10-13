"""Exercise the downloaded Mac worker using only disposable synthetic journals.

No working journal, iCloud folder, database archive, credentials or agent is
read or modified. Temporary rehearsal files are removed after completion.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile

DEVICE = '12345678-1234-1234-1234-123456789abc'
IDENTITY = 'abcdefab-cdef-abcd-efab-cdefabcdefab'


def load_worker(path):
    spec = importlib.util.spec_from_file_location('ldc_rehearsal_worker', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not all(callable(getattr(module, name, None)) for name in ('protect', 'snapshot', 'validate_current', 'retention_plan')):
        raise RuntimeError('The downloaded helper is missing retention support. Update it first.')
    return module


def synthetic_envelope(revision):
    at = (datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=revision)).isoformat()
    state = {'records':[{'id':'synthetic-cook', 'food':'Synthetic retention ribs', 'cooker':'Synthetic kettle',
        'startedAt':'2026-01-01T10:00:00Z','finishedAt':'2026-01-01T12:00:00Z','phase':'Finished',
        'events':[{'id':'synthetic-on','type':'Meat On','at':'2026-01-01T10:00:00Z','note':'Synthetic event'},
                  {'id':'synthetic-off','type':'Cook Finished','at':'2026-01-01T12:00:00Z','note':'Synthetic finish'}],
        'temperatures':[{'at':'2026-01-01T10:00:00Z','value':225,'unit':'F','channel':'Synthetic pit'}],
        'notes':f'Synthetic revision {revision}', 'evaluation':'Synthetic evaluation',
        'cookingDetails':{'method':'No wrap','equipment':'Synthetic kettle','preparation':'Synthetic dry brine','rating':4},
        'isTestCook':True}], 'relationalArchives':[]}
    payload=json.dumps({'version':1,'revision':revision,'createdAt':at,'state':state},ensure_ascii=False)
    return {'format':'ldcooklog-recovery','version':1,'payload':payload,'sha256':hashlib.sha256(payload.encode()).hexdigest()}


def fingerprints(folder):
    return {str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*.recovery.json')}


def run_rehearsal(worker):
    with tempfile.TemporaryDirectory(prefix='ldcooklog-synthetic-retention-') as temporary:
        root=Path(temporary)
        source=root/'Synthetic source'
        device=source/DEVICE
        device.mkdir(parents=True)
        destination=root/'Independent synthetic Mac copies'
        for revision in range(1,51):
            path=device/f'{revision:016d}-{IDENTITY}.recovery.json'
            path.write_text(json.dumps(synthetic_envelope(revision)))
            worker.protect(source,destination)
        source_before=fingerprints(source)
        initial=list(destination.rglob('*.recovery.json'))
        revisions={int(p.name[:16]) for p in initial}
        if not {1,48,49,50}.issubset(revisions) or len(initial)>=50:
            raise RuntimeError('Normal retention did not keep required recovery points and remove older copies')
        normal=len(initial)
        maximum=max(p.stat().st_size for p in initial)*5
        report=worker.protect(source,destination,max_bytes=maximum)
        retained=list(destination.rglob('*.recovery.json'))
        if report['capacity']['bytes']>maximum or not {1,48,49,50}.issubset({int(p.name[:16]) for p in retained}):
            raise RuntimeError('Budget retention failed')
        before=fingerprints(destination)
        try:
            worker.protect(source,destination,max_bytes=1)
        except worker.AuditFailure:
            pass
        else:
            raise RuntimeError('An impossible capacity limit was incorrectly accepted')
        if fingerprints(destination)!=before:
            raise RuntimeError('Capacity failure changed retained copies')
        corrupted=device/f'{51:016d}-{IDENTITY}.recovery.json'
        corrupted.write_text('Synthetic damaged data')
        try:
            worker.protect(source,destination)
        except (worker.AuditFailure,ValueError):
            pass
        else:
            raise RuntimeError('Damaged newest source was incorrectly accepted')
        if fingerprints(destination)!=before:
            raise RuntimeError('Source damage changed retained copies')
        corrupted.unlink()
        if fingerprints(source)!=source_before:
            raise RuntimeError('Source recovery bytes changed')
        latest=destination/report['copies'][0]['snapshot']
        fresh=root/'Fresh synthetic restore'
        fresh.mkdir()
        restored=fresh/latest.name
        shutil.copyfile(latest,restored)
        body=worker.snapshot(restored)
        worker.validate_current(body)
        if body['state']!=json.loads(synthetic_envelope(50)['payload'])['state']:
            raise RuntimeError('Fresh-folder recovery differs from the synthetic latest state')
        return {'normal':normal,'budget':len(retained),'restoredRevision':body['revision']}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker',type=Path,default=Path.home()/'Downloads/LDCookLog-Mac-Recovery.py')
    args=parser.parse_args()
    try:
        result=run_rehearsal(load_worker(args.worker))
    except (RuntimeError,OSError,ValueError,ImportError,AttributeError,KeyError):
        print('SYNTHETIC REHEARSAL FAILED. No working cooking data, backups or scheduled agent were accessed.')
        return 1
    print(f"SYNTHETIC RETENTION PASS: 50 saves; {result['normal']} normal-policy copies; {result['budget']} budget-limited copies; first/newest three kept.")
    print('CAPACITY AND CORRUPTION PASS: failed checks preserved all retained synthetic copies.')
    print(f"FRESH-FOLDER RECOVERY PASS: revision {result['restoredRevision']}; exact synthetic cook, events, temperatures and setup preserved.")
    print('Working cooking data, iCloud snapshots, original archives and scheduled agent were not accessed. Temporary synthetic files removed.')
    print('This is a Mac filesystem rehearsal; actual iPhone retention and new-device restoration are separate checks.')
    return 0


if __name__=='__main__':
    raise SystemExit(main())
