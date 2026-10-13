import unittest
from pathlib import Path
from unittest.mock import patch
import rehearse_retention as rehearsal


class RehearsalTests(unittest.TestCase):
    def test_standalone_rehearsal_uses_only_temporary_sources_and_destinations(self):
        worker=rehearsal.load_worker(Path(__file__).with_name('LDCookLog-Mac-Recovery.py'))
        original=worker.protect
        calls=[]
        def protect(source,destination,*args,**kwargs):
            self.assertNotEqual(source,worker.DEFAULT_SOURCE)
            self.assertNotEqual(destination,worker.DEFAULT_DESTINATION)
            self.assertIn('ldcooklog-synthetic-retention-',str(source))
            calls.append((source,destination))
            return original(source,destination,*args,**kwargs)
        with patch.object(worker,'protect',side_effect=protect), patch.object(worker,'publish_reports',return_value=False), patch.object(worker.subprocess,'run',side_effect=AssertionError('No agent, external API or download bridge needed')):
            result=rehearsal.run_rehearsal(worker)
        self.assertEqual(result['restoredRevision'],50)
        self.assertLess(result['normal'],50)
        self.assertLessEqual(result['budget'],5)
        self.assertEqual(len(calls),53)
        self.assertTrue(all(not source.exists() and not destination.exists() for source,destination in calls))

if __name__=='__main__':
    unittest.main()
