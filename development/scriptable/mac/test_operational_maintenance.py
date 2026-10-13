import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import maintain_verified_recovery as worker

class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home=Path(self.temporary.name)

    def test_failure_cooldown_recovery_and_next_failure(self):
        with patch.object(worker,'send_local_notice',return_value=True) as notice:
            worker.operational_maintenance(False,home=self.home,now=1000)
            worker.operational_maintenance(False,home=self.home,now=1300)
            self.assertEqual(notice.call_count,1)
            worker.operational_maintenance(False,home=self.home,now=16000)
            worker.operational_maintenance(True,home=self.home,now=16300)
            worker.operational_maintenance(True,home=self.home,now=16600)
            worker.operational_maintenance(False,home=self.home,now=16900)
            self.assertEqual([c.args[0] for c in notice.call_args_list],['failed','failed','recovered','failed'])
        state=json.loads((self.home/'notification-status.json').read_text())
        self.assertTrue(state['failed'])
        self.assertEqual((self.home/'notification-status.json').stat().st_mode & 0o777,0o600)

    def test_capacity_notices_are_daily_and_rearm_after_capacity_clears(self):
        with patch.object(worker,'send_local_notice',return_value=True) as notice:
            for now in [1000,1300,90000]:worker.operational_maintenance(True,{'warning':True},home=self.home,now=now)
            self.assertEqual(notice.call_count,2)
            worker.operational_maintenance(True,{'warning':False},home=self.home,now=90300)
            worker.operational_maintenance(True,{'warning':True},home=self.home,now=90600)
            self.assertEqual(notice.call_count,3)

    def test_log_tail_bounded_with_original_inode_kept(self):
        path=self.home/'recovery-worker.log';path.write_bytes(b'0123456789abcdefghij')
        inode=path.stat().st_ino
        unrelated=self.home/'owner-note.txt';unrelated.write_text('keep')
        worker.trim_worker_logs(self.home,maximum=16,retained=8)
        self.assertEqual(path.read_bytes(),b'')
        self.assertEqual(path.stat().st_ino,inode)
        self.assertEqual((self.home/'recovery-worker.log.previous').read_bytes(),b'cdefghij')
        self.assertEqual(unrelated.read_text(),'keep')
        self.assertEqual((self.home/'recovery-worker.log.previous').stat().st_mode & 0o777,0o600)

    def test_symlink_log_and_notification_state_leave_targets_unchanged(self):
        target=self.home/'owner-note.txt';target.write_text('unchanged')
        (self.home/'recovery-worker.log').symlink_to(target)
        worker.operational_maintenance(False,home=self.home,now=1000)
        self.assertEqual(target.read_text(),'unchanged')
        self.assertFalse((self.home/'notification-status.json').exists())
        (self.home/'recovery-worker.log').unlink()
        (self.home/'notification-status.json').symlink_to(target)
        worker.operational_maintenance(False,home=self.home,now=1000)
        self.assertEqual(target.read_text(),'unchanged')

    def test_notice_uses_only_static_text_and_has_bounded_safe_failure(self):
        with patch.object(worker.sys,'platform','darwin'), patch.object(worker.subprocess,'run',return_value=subprocess.CompletedProcess([],0)) as run:
            self.assertTrue(worker.send_local_notice('failed'))
            args=run.call_args.args[0]
            self.assertEqual(args[:2],['/usr/bin/osascript','-e'])
            self.assertEqual(run.call_args.kwargs['timeout'],8)
            self.assertNotIn('shell',run.call_args.kwargs)
            self.assertNotIn(str(self.home),args[-1])
            self.assertFalse(worker.send_local_notice('PRIVATE COOK NOTES'))
            self.assertEqual(run.call_count,1)
        with patch.object(worker.sys,'platform','darwin'), patch.object(worker.subprocess,'run',side_effect=subprocess.TimeoutExpired([],8)):
            self.assertFalse(worker.send_local_notice('failed'))

    def test_notification_rejection_does_not_create_healthy_backup_receipts(self):
        with patch.object(worker,'send_local_notice',return_value=False):
            worker.operational_maintenance(False,home=self.home,now=1000)
        self.assertFalse((self.home/'status.json').exists())
        self.assertFalse((self.home/'last-attempt.json').exists())
        self.assertFalse(json.loads((self.home/'notification-status.json').read_text())['lastRequestAccepted'])

    @unittest.skipUnless(sys.platform=='darwin','actual AppleScript compilation is macOS-only')
    def test_fixed_notification_scripts_compile_without_delivering_notifications(self):
        for kind,(title,message) in worker.NOTICE_TEXT.items():
            script='display notification '+json.dumps(message)+' with title '+json.dumps(title)
            result=subprocess.run(['/usr/bin/osacompile','-o',str(self.home/(kind+'.scpt')),'-e',script],capture_output=True,timeout=8)
            self.assertEqual(result.returncode,0,'Fixed local notification script did not compile')

if __name__=='__main__':unittest.main()
