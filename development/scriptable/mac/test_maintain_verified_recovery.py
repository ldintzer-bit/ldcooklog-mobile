import json
import errno
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

    def test_permission_diagnostic_excludes_exception_text_paths_and_record_contents(self):
        from contextlib import redirect_stdout
        from io import StringIO
        output = StringIO()
        protect(self.source, self.destination)
        error = PermissionError(1, 'PRIVATE COOK NOTE PASSWORD', '/private/secret-data')
        args = ['helper', '--scheduled', '--icloud-root', str(self.source), '--destination', str(self.destination)]
        with patch.object(worker.sys, 'argv', args), patch.object(worker, 'latest_journals', side_effect=error), redirect_stdout(output):
            self.assertEqual(worker.main(), 1)
        text = output.getvalue()
        self.assertIn('reading iCloud recovery snapshots / PermissionError / errno 1', text)
        self.assertNotIn('PRIVATE COOK', text)
        self.assertNotIn('/private/secret-data', text)
        attempt = json.loads((self.destination / 'last-attempt.json').read_text())
        self.assertEqual(attempt['details'], dict(stage='read_icloud', errorType='PermissionError', errno=1, errnoName=errno.errorcode[1]))
        self.assertNotIn('PASSWORD', json.dumps(attempt))
        with self.assertRaisesRegex(AuditFailure, 'PermissionError / errno 1'): worker.show_status(self.destination)

    def test_standalone_diagnosis_does_not_create_destination_or_change_source(self):
        artifact = Path(__file__).with_name('LDCookLog-Mac-Recovery.py')
        before = self.file.read_bytes()
        command = [sys.executable, str(artifact), '--diagnose', '--icloud-root', str(self.source), '--destination', str(self.destination)]
        result = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('TERMINAL ICLOUD READ PASS', result.stdout)
        self.assertFalse(self.destination.exists())
        self.assertEqual(self.file.read_bytes(), before)

    def test_temporary_unavailable_file_requests_download_and_then_copies_verified_bytes(self):
        original = Path.read_bytes
        attempts = [0]
        def read(path):
            if path == self.file:
                attempts[0] += 1
                if attempts[0] <= 2:
                    raise OSError(errno.EAGAIN, 'Private pathname must not be logged')
            return original(path)
        with patch.object(Path, 'read_bytes', read), patch.object(worker, 'request_icloud_download', return_value=dict(requested=True)) as request, patch.object(worker.time, 'sleep'):
            report = protect(self.source, self.destination)
        request.assert_called_once_with(self.file)
        self.assertEqual(report['copies'][0]['revision'], 3)
        self.assertEqual((self.destination / report['copies'][0]['snapshot']).read_bytes(), self.file.read_bytes())

    def test_transient_retry_budget_expires_without_fallback_or_backup_changes(self):
        report = protect(self.source, self.destination)
        target = self.destination / report['copies'][0]['snapshot']
        before = target.read_bytes()
        original = Path.read_bytes
        clock = [0]
        def read(path):
            if path == self.file:
                raise OSError(errno.EAGAIN, 'Private error text')
            return original(path)
        def advance(seconds): clock[0] += seconds
        with patch.object(Path, 'read_bytes', read), patch.object(worker.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(worker.time, 'sleep', side_effect=advance), patch.object(worker, 'request_icloud_download', return_value=dict(requested=True)) as request:
            with self.assertRaises(OSError) as raised: protect(self.source, self.destination)
        self.assertEqual(raised.exception.errno, errno.EAGAIN)
        self.assertEqual(clock[0], 45)
        request.assert_called_once()
        self.assertEqual(target.read_bytes(), before)

    def test_permission_error_is_not_retried_or_treated_as_download_pending(self):
        original = Path.read_bytes
        def read(path):
            if path == self.file: raise PermissionError(1, 'Private path')
            return original(path)
        with patch.object(Path, 'read_bytes', read), patch.object(worker, 'request_icloud_download') as request, patch.object(worker.time, 'sleep') as sleep:
            with self.assertRaises(PermissionError): protect(self.source, self.destination)
        request.assert_not_called()
        sleep.assert_not_called()
        self.assertFalse(self.destination.exists())

    def test_materialized_corruption_still_stops_before_any_copy(self):
        original = Path.read_bytes
        bad = dict(self.envelope, payload=self.envelope['payload'] + ' ')
        attempts = [0]
        def read(path):
            if path == self.file:
                attempts[0] += 1
                if attempts[0] == 1: raise OSError(errno.EAGAIN, 'unavailable')
                return json.dumps(bad).encode()
            return original(path)
        with patch.object(Path, 'read_bytes', read), patch.object(worker, 'request_icloud_download', return_value=dict(requested=True)), patch.object(worker.time, 'sleep'):
            with self.assertRaisesRegex(AuditFailure, 'checksum'): protect(self.source, self.destination)
        self.assertFalse(self.destination.exists())

    def test_native_request_arguments_and_diagnostics_are_safe_and_bounded(self):
        path = self.root / "quotes ' and $(private command)"
        result = subprocess.CompletedProcess([], 0, stdout=json.dumps(dict(requested=False, code=260, secret='DO NOT PRINT')), stderr='Private path')
        with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.subprocess, 'run', return_value=result) as run:
            self.assertEqual(worker.request_icloud_download(path), dict(requested=False, code=260))
        args = run.call_args.args[0]
        self.assertEqual(args[-1], str(path))
        self.assertNotIn(str(path), args[-2])
        self.assertEqual(run.call_args.kwargs['timeout'], 8)
        with patch.object(worker.sys, 'platform', 'darwin'), patch.object(worker.subprocess, 'run', side_effect=subprocess.TimeoutExpired([], 8)):
            self.assertEqual(worker.request_icloud_download(path), dict(requested=False, timeout=True))

    def test_darwin_cloud_deadlock_errno_uses_platform_symbol_and_recovers(self):
        original = Path.read_bytes
        calls = [0]
        def read(path):
            if path == self.file:
                calls[0] += 1
                if calls[0] == 1: raise OSError(errno.EDEADLK, 'Private path')
            return original(path)
        with patch.object(Path, 'read_bytes', read), patch.object(worker, 'request_icloud_download', return_value=dict(requested=True)) as request, patch.object(worker.time, 'sleep'):
            report = protect(self.source, self.destination)
        request.assert_called_once()
        self.assertEqual(report['copies'][0]['revision'], 3)
        worker.stage('read_icloud')
        details = worker.error_details(OSError(errno.EDEADLK, 'PRIVATE DATA'))
        self.assertEqual(details['errnoName'], 'EDEADLK')
        self.assertIn('EDEADLK', worker.format_details(details))


if __name__ == '__main__': unittest.main()
