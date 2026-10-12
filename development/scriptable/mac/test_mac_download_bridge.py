from pathlib import Path
import sys
import tempfile
import unittest
from maintain_verified_recovery import request_icloud_download


class NativeDownloadBridgeTests(unittest.TestCase):
    @unittest.skipUnless(sys.platform == 'darwin', 'Requires actual macOS Foundation/osascript')
    def test_real_foundation_bridge_accepts_safe_file_argument(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "Synthetic ' quoted local file.json"
            path.write_text('Synthetic only; not an iCloud item')
            result = request_icloud_download(path)
            # A local non-iCloud file may be refused. It must still reach the
            # actual Foundation method and return safe structured diagnostics.
            self.assertIs(type(result['requested']), bool)
            self.assertNotIn('bridgeFailure', result)
            self.assertNotIn('timeout', result)
            self.assertEqual(path.read_text(), 'Synthetic only; not an iCloud item')


if __name__ == '__main__': unittest.main()
