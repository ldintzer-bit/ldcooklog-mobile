import json
from pathlib import Path
import plistlib
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import maintain_verified_recovery as worker
import test_reconcile_private_history as fixtures
from maintain_verified_recovery import AuditFailure, agent_plist, owned_agent, protect


class VerifiedMacCopyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures.PrivateReconciliationTests.setUpClass()
        cls.envelope = fixtures.PrivateReconciliationTests.envelope

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.source = self.root / 'iCloud'
        device = self.source / '12345678-1234-1234-1234-123456789abc'
        device.mkdir(parents=True)
        self.file = device / '0000000000000003-12345678-1234-1234-1234-123456789abc.recovery.json'
        self.file.write_text(json.dumps(self.envelope))
        self.destination = self.root / 'private Mac copies'

    def test_verified_immutable_copy_private_permissions_and_idempotency(self):
        source_bytes = self.file.read_bytes()
        report = protect(self.source, self.destination)
        copy = self.destination / report['copies'][0]['snapshot']
        self.assertEqual(copy.read_bytes(), source_bytes)
        self.assertEqual(report['copies'][0]['cooks'], 3)
        self.assertEqual(stat.S_IMODE(copy.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.destination.stat().st_mode), 0o700)
        protect(self.source, self.destination)
        self.assertEqual(len(list(self.destination.rglob('*.recovery.json'))), 1)
        self.assertEqual(self.file.read_bytes(), source_bytes)
        self.assertTrue(json.loads((self.destination / 'last-attempt.json').read_text())['healthy'])

    def test_missing_cloud_and_corrupt_newest_do_not_replace_last_good_backup(self):
        report = protect(self.source, self.destination)
        target = self.destination / report['copies'][0]['snapshot']
        before = target.read_bytes()
        newest = self.file.with_name(self.file.name.replace('0000000000000003', '0000000000000004'))
        newest.write_text('damaged')
        with self.assertRaises(ValueError): protect(self.source, self.destination)
        self.assertEqual(target.read_bytes(), before)
        with self.assertRaises(AuditFailure): protect(self.root / 'absent', self.destination)
        self.assertEqual(target.read_bytes(), before)

    def test_copy_conflict_and_quota_never_overwrite_or_delete(self):
        report = protect(self.source, self.destination)
        target = self.destination / report['copies'][0]['snapshot']
        target.write_text('Evidence retained')
        with self.assertRaises(AuditFailure): protect(self.source, self.destination)
        self.assertEqual(target.read_text(), 'Evidence retained')
        limited = self.root / 'limited'
        with self.assertRaisesRegex(AuditFailure, 'size limit'): protect(self.source, limited, max_bytes=1)
        self.assertEqual(list(limited.rglob('*.recovery.json')), [])

    def test_destination_symlink_and_overlapping_folders_are_refused(self):
        self.destination.symlink_to(self.source, target_is_directory=True)
        before = self.file.read_bytes()
        with self.assertRaises(AuditFailure): protect(self.source, self.destination)
        self.assertEqual(self.file.read_bytes(), before)
        with self.assertRaises(AuditFailure): protect(self.source, self.source / 'nested')

    def test_agent_arguments_are_structured_and_unrelated_agents_are_not_replaced(self):
        programs = self.root / 'Programs'
        program = programs / 'version.py'
        plist = agent_plist(program, Path('/path with spaces/python3'), self.destination)
        self.assertEqual(plist['StartInterval'], 300)
        self.assertEqual(plist['ProgramArguments'], ['/path with spaces/python3', str(program), '--scheduled'])
        self.assertTrue(plist['RunAtLoad'])
        file = self.root / 'agent.plist'
        file.write_bytes(plistlib.dumps(plist))
        self.assertTrue(owned_agent(file, programs))
        plist['Label'] = 'unrelated'
        file.write_bytes(plistlib.dumps(plist))
        before = file.read_bytes()
        with self.assertRaises(AuditFailure): owned_agent(file, programs)
        self.assertEqual(file.read_bytes(), before)

    def test_standalone_worker_success_failure_and_no_private_log_contents(self):
        artifact = Path(__file__).with_name('LDCookLog-Mac-Recovery.py')
        command = [sys.executable, str(artifact), '--icloud-root', str(self.source), '--destination', str(self.destination)]
        result = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('MAC INDEPENDENT COPY PASS', result.stdout)
        self.assertNotIn('Synthetic café', result.stdout)
        self.assertNotIn(str(self.source), result.stdout)
        newest = self.file.with_name(self.file.name.replace('0000000000000003', '0000000000000004'))
        newest.write_text('damaged')
        result = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads((self.destination / 'last-attempt.json').read_text())['healthy'])
        self.assertTrue(json.loads((self.destination / 'status.json').read_text())['healthy'], 'Last successful evidence retained separately from current failure')
        self.assertEqual(newest.read_text(), 'damaged')

    def test_failed_agent_registration_keeps_verified_copies_and_removes_only_new_plist(self):
        home = self.root / 'home'
        support = home / 'Library/Application Support/LDCookLog'
        destination = support / 'Verified Recovery'
        artifact = Path(__file__).with_name('LDCookLog-Mac-Recovery.py')
        with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.os, 'geteuid', return_value=1000), patch.object(worker.Path, 'home', return_value=home), patch.object(worker, 'MAC_HOME', support), patch.object(worker, 'DEFAULT_SOURCE', self.source), patch.object(worker, 'DEFAULT_DESTINATION', destination), patch.object(worker, '__file__', str(artifact)), patch.object(worker, 'LDC_STANDALONE', True, create=True), patch.object(worker.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            with self.assertRaisesRegex(AuditFailure, 'could not start'): worker.install()
        self.assertEqual(len(list(destination.rglob('*.recovery.json'))), 1)
        self.assertEqual(list((home / 'Library/LaunchAgents').glob('*.plist')), [])
        self.assertTrue(json.loads((destination / 'status.json').read_text())['healthy'])

    def test_status_requires_recent_scheduled_execution_and_revalidates_copy(self):
        protect(self.source, self.destination)
        with self.assertRaisesRegex(AuditFailure, 'manual'): worker.show_status(self.destination)
        protect(self.source, self.destination, scheduled=True)
        from contextlib import redirect_stdout
        from io import StringIO
        output = StringIO()
        with redirect_stdout(output): worker.show_status(self.destination)
        self.assertIn('RECENT SCHEDULED EXECUTION VERIFIED', output.getvalue())
        receipt = self.destination / 'last-attempt.json'
        status = json.loads(receipt.read_text())
        status['checkedAt'] = '2020-01-01T00:00:00+00:00'
        receipt.write_text(json.dumps(status))
        with self.assertRaisesRegex(AuditFailure, 'stale'): worker.show_status(self.destination)
        protect(self.source, self.destination, scheduled=True)
        target = self.destination / status['copies'][0]['snapshot']
        target.write_text('damaged')
        with self.assertRaises(ValueError): worker.show_status(self.destination)


if __name__ == '__main__': unittest.main()
