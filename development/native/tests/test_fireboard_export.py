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

class DiagnosticTests(unittest.TestCase):
    def test_safe_distinct_network_diagnostics(self):
        import ssl, socket
        for error, message in [(ssl.SSLCertVerificationError(1,'PRIVATE'),'TLS certificate verification'), (socket.gaierror(8,'PRIVATE'),'DNS lookup'), (TimeoutError('PRIVATE'),'timed out'), (ConnectionResetError('PRIVATE'),'reset'), (OSError(13,'PRIVATE'),'errno 13')]:
            with self.subTest(message=message):
                result=m.connection_failure(urllib.error.URLError(error))
                self.assertIn(message,result)
                self.assertNotIn('PRIVATE',result)

    def test_diagnose_has_no_credentials_and_accepts_method_not_allowed(self):
        error=urllib.error.HTTPError('https://fireboard.io/',405,'PRIVATE',{},None)
        with patch.object(m.urllib.request,'build_opener') as opener, patch('sys.stdout',new_callable=io.StringIO) as out:
            opener.return_value.open.side_effect=error
            self.assertEqual(m.diagnose(),0)
            req=opener.return_value.open.call_args.args[0]
            self.assertIsNone(req.data)
            self.assertIsNone(req.get_header('Authorization'))
            self.assertIn('HTTP 405',out.getvalue())
            self.assertNotIn('PRIVATE',out.getvalue())

    def test_invalid_json_does_not_print_body(self):
        with patch.object(m.urllib.request,'build_opener') as opener:
            opener.return_value.open.return_value.__enter__.return_value.read.return_value=b'PRIVATE invalid response'
            with self.assertRaisesRegex(RuntimeError,'^FireBoard returned an unreadable JSON response; no export written$'):
                m.api('api/rest-auth/login/',credentials={'password':'PRIVATE'})

    def test_diagnose_tls_failure(self):
        import ssl
        with patch.object(m.urllib.request,'build_opener') as opener, patch('sys.stdout',new_callable=io.StringIO) as out:
            opener.return_value.open.side_effect=urllib.error.URLError(ssl.SSLCertVerificationError(1,'PRIVATE'))
            self.assertEqual(m.diagnose(),1)
            self.assertIn('TLS certificate verification',out.getvalue())
            self.assertNotIn('PRIVATE',out.getvalue())

class CertificateSetupTests(unittest.TestCase):
    def test_mac_loads_system_roots_without_weakening_tls(self):
        import ssl
        context=ssl.create_default_context()
        with patch.object(m.sys,'platform','darwin'), patch.dict(m.os.environ,{},clear=True), patch.object(m.Path,'is_file',return_value=True), patch.object(m.ssl,'create_default_context',return_value=context), patch.object(context,'load_verify_locations') as load, patch.object(m.urllib.request,'build_opener') as build:
            m.https_opener()
            load.assert_called_once_with(cafile='/etc/ssl/cert.pem')
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
            self.assertIsInstance(build.call_args.args[1],m.urllib.request.HTTPSHandler)

    def test_explicit_certificate_setting_is_respected(self):
        from unittest.mock import MagicMock
        context=MagicMock()
        with patch.object(m.sys,'platform','darwin'), patch.dict(m.os.environ,{'SSL_CERT_FILE':'/explicit/operator/roots.pem'}), patch.object(m.ssl,'create_default_context',return_value=context), patch.object(m.urllib.request,'build_opener'):
            m.https_opener()
            context.load_verify_locations.assert_not_called()

if __name__ == '__main__':
    unittest.main()
