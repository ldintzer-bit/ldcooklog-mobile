import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from check_icloud_recovery import check_root, inspect_snapshot


class RecoveryCheckTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.device = self.root / '12345678-1234-1234-1234-123456789abc'
        self.device.mkdir()

    def snapshot(self, revision=1):
        # Noncanonical whitespace and Unicode must hash as exact UTF-8 text.
        payload = json.dumps(dict(version=1, revision=revision, createdAt='2026-10-11T20:00:00Z', state=dict(records=[dict(id='synthetic', food='Ribs – 测试', events=[dict(type='Note')], temperatures=[])], relationalArchives=[])), ensure_ascii=False, indent=2)
        envelope = dict(format='ldcooklog-recovery', version=1, payload=payload, sha256=hashlib.sha256(payload.encode()).hexdigest())
        path = self.device / f'{revision:016d}-12345678-1234-1234-1234-123456789abc.recovery.json'
        path.write_text(json.dumps(envelope))
        return path

    def test_exact_payload_and_latest_counts(self):
        self.snapshot(); self.snapshot(2)
        result = check_root(self.root)
        self.assertEqual(result, [dict(snapshots=2, latest=dict(revision=2, cooks=1, events=1, readings=0, archives=0))])

    def test_tamper_and_revision_mismatch(self):
        path = self.snapshot()
        envelope = json.loads(path.read_text()); envelope['payload'] += ' '
        path.write_text(json.dumps(envelope))
        with self.assertRaises(ValueError): inspect_snapshot(path)
        path = self.snapshot()
        other = path.with_name(path.name.replace('0000000000000001', '0000000000000002'))
        path.rename(other)
        with self.assertRaises(ValueError): inspect_snapshot(other)

    def test_corrupt_newest_no_silent_fallback_or_changes(self):
        old = self.snapshot(); old_bytes = old.read_bytes()
        new = self.snapshot(2); new.write_text('broken')
        with self.assertRaises(ValueError): check_root(self.root)
        self.assertEqual(old.read_bytes(), old_bytes)
        self.assertEqual(new.read_text(), 'broken')

    def test_conflicts_and_empty_cloud_stop(self):
        with self.assertRaises(ValueError): check_root(self.root)
        path = self.snapshot()
        duplicate = path.with_name(path.name.replace('123456789abc', '123456789abd'))
        duplicate.write_bytes(path.read_bytes())
        with self.assertRaises(ValueError): check_root(self.root)


if __name__ == '__main__': unittest.main()
