import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).parents[1] / 'export_completed_fireboard.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SESSION = dict(id=12, title='Synthetic session', start_time='2026-01-01T01:00:00Z', end_time='2026-01-01T02:00:00Z')

class ExportTests(unittest.TestCase):
    def test_login_uses_documented_endpoint_preserves_password_and_does_not_print_token(self):
        out = io.StringIO()
        with patch('builtins.input', return_value='synthetic@example.invalid'), patch.object(m, 'secret', return_value=' password '), patch.object(m, 'api', return_value={'key':'synthetic-token'}) as api, patch('sys.stdout',out):
            self.assertEqual(m.login(), 'synthetic-token')
        api.assert_called_once_with('api/rest-auth/login/', credentials={'username':'synthetic@example.invalid','password':' password '})
        self.assertNotIn('synthetic-token',out.getvalue())

    def test_selection_excludes_incomplete_and_removes_console_controls(self):
        rows = [dict(SESSION, title='ribs\x1b\n'),dict(SESSION,id=13,end_time=None)]
        with patch.object(m,'request',return_value=rows), patch('builtins.input',return_value='1'), patch('sys.stdout',new_callable=io.StringIO) as out:
            self.assertEqual(m.choose_session('token'),12)
            self.assertNotIn('\x1b',out.getvalue())
            self.assertNotIn('2.',out.getvalue())

    def test_http_errors_do_not_expose_private_response_or_credentials(self):
        error = urllib.error.HTTPError('https://fireboard.io/private',401,'secret-response',{},None)
        with patch.object(m.urllib.request,'build_opener') as opener:
            opener.return_value.open.side_effect=error
            with self.assertRaisesRegex(RuntimeError, r'^FireBoard request failed \(HTTP 401\); no export written$'):
                m.api('api/rest-auth/login/',credentials={'password':'secret'})

    def test_redirects_are_refused(self):
        self.assertIsNone(m.NoRedirect().redirect_request(None,None,302,'',{},'https://other.invalid'))

    def test_getpass_fallback_is_refused(self):
        import warnings
        def fallback(prompt):
            warnings.warn('cannot hide input',m.getpass.GetPassWarning)
            self.fail('must not read echoed input')
        with patch.object(m.getpass,'getpass',side_effect=fallback):
            with self.assertRaisesRegex(RuntimeError,'Open Terminal'):
                m.secret('Password: ')

    def test_interactive_export_excludes_credentials_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(m.Path,'home',return_value=Path(directory)), patch('sys.argv',['export','--interactive']), patch.object(m,'login',return_value='synthetic-secret'), patch.object(m,'choose_session',return_value=12), patch.object(m,'request',side_effect=[dict(SESSION,owner={'token':'private'}),[]]), patch('sys.stdout',new_callable=io.StringIO) as out:
            self.assertEqual(m.main(),0)
            files=list(Path(directory).rglob('*.json'))
            self.assertEqual(len(files),1)
            raw=files[0].read_text()
            self.assertNotIn('private',raw)
            self.assertNotIn('synthetic-secret',raw+out.getvalue())
            self.assertEqual(json.loads(raw)['session']['id'],12)
            self.assertEqual(files[0].stat().st_mode & 0o777,0o600)
            with patch('sys.argv',['export','12',str(files[0])]), patch.object(m,'secret') as secret:
                self.assertEqual(m.main(),1)
                secret.assert_not_called()
            self.assertEqual(files[0].read_text(),raw)

    def test_wrong_session_identity_does_not_write(self):
        with tempfile.TemporaryDirectory() as directory, patch('sys.argv',['export','12',str(Path(directory)/'export.json')]), patch.object(m,'secret',return_value='token'), patch.object(m,'request',return_value=dict(SESSION,id=13)), patch('sys.stdout',new_callable=io.StringIO):
            self.assertEqual(m.main(),1)
            self.assertFalse(list(Path(directory).iterdir()))

if __name__ == '__main__':
    unittest.main()
