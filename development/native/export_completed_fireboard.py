"""Mac administration helper. Export one completed session; no Supabase access.

The FireBoard account token is entered invisibly, used in memory only, and is
never written to the export. Save exports outside the public git checkout.
"""
import argparse
import datetime as dt
import getpass
import json
import os
import warnings
from pathlib import Path
import tempfile
import urllib.request
import urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api(path, token=None, credentials=None):
    headers = {'User-Agent':'LDCookLog/2.0 completed-session-export', 'Accept':'application/json'}
    data = None
    if credentials is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(credentials).encode('utf-8')
    if token is not None:
        headers['Authorization'] = 'Token ' + token
    req = urllib.request.Request('https://fireboard.io/' + path, data=data, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            raw = response.read(100 * 1024 * 1024 + 1)
            if len(raw) > 100 * 1024 * 1024:
                raise RuntimeError('FireBoard response exceeds the supported size; no export written')
            return json.loads(raw)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'FireBoard request failed (HTTP {error.code}); no export written') from None
    except (OSError, ValueError):
        raise RuntimeError('FireBoard connection or response could not be read; no export written') from None


def request(path, token):
    return api('api/v1/' + path, token=token)


def secret(prompt):
    # Never allow getpass to fall back to visibly echoed input.
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        try:
            return getpass.getpass(prompt)
        except getpass.GetPassWarning:
            raise RuntimeError('Open Terminal directly to enter hidden credentials') from None


def login():
    username = input('FireBoard email or username: ').strip()
    password = secret('FireBoard password (hidden; not saved): ')
    if not username or not password:
        raise RuntimeError('Email/username and password are required')
    value = api('api/rest-auth/login/', credentials={'username':username, 'password':password})
    token = value.get('key') if isinstance(value, dict) else None
    if not isinstance(token, str) or not token or any(c.isspace() for c in token):
        raise RuntimeError('FireBoard did not return a usable account token')
    return token


def completed(raw):
    try:
        start = dt.datetime.fromisoformat(str(raw.get('start_time') or '').replace('Z','+00:00'))
        end = dt.datetime.fromisoformat(str(raw.get('end_time') or '').replace('Z','+00:00'))
        return start.tzinfo is not None and end.tzinfo is not None and start <= end <= dt.datetime.now(dt.timezone.utc)
    except (ValueError, AttributeError, TypeError):
        return False


def choose_session(token):
    rows = request('sessions.json', token)
    if not isinstance(rows, list):
        raise RuntimeError('Unexpected session list; no export written')
    rows = [r for r in rows if isinstance(r, dict) and type(r.get('id')) is int and r['id'] > 0 and completed(r)]
    rows.sort(key=lambda r: dt.datetime.fromisoformat(r['start_time'].replace('Z','+00:00')), reverse=True)
    if not rows:
        raise RuntimeError('No completed sessions found')
    print('Completed sessions (newest first; titles stay on this Mac):')
    for n, row in enumerate(rows, 1):
        title = ''.join(c for c in str(row.get('title') or 'Untitled') if c.isprintable())[:100]
        print(f"{n}. {row['start_time']} — {title}")
    selection = input('Enter the list number of the session to export (or q to cancel): ').strip()
    if selection.lower() == 'q':
        return None
    if not selection.isdigit() or not 1 <= int(selection) <= len(rows):
        raise RuntimeError('Invalid selection; no export written')
    return rows[int(selection)-1]['id']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session_id', type=int, nargs='?')
    parser.add_argument('--interactive', action='store_true', help='Sign in privately and select a completed session')
    parser.add_argument('output', type=Path, nargs='?')
    args = parser.parse_args()
    if args.interactive and (args.session_id is not None or args.output is not None):
        parser.error('Use --interactive alone')
    if not args.interactive and (args.session_id is None or args.session_id <= 0 or args.output is None):
        parser.error('Supply a positive session ID and output path, or use --interactive')
    try:
        if args.interactive:
            token = login()
            args.session_id = choose_session(token)
            if args.session_id is None:
                print('Cancelled. No export written.')
                return 0
            stamp = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
            args.output = Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/LDCookLog Backups' / f'FireBoard-{args.session_id}-{stamp}.json'
        if args.output.exists():
            raise RuntimeError('Choose a new output filename; existing exports are never overwritten')
        if any((parent / '.git').exists() for parent in [args.output.resolve().parent, *args.output.resolve().parents]):
            raise RuntimeError('Save the private export outside every Git repository')
        if not args.interactive:
            token = secret('FireBoard API token (hidden; not saved): ').strip()
        if not token:
            raise RuntimeError('Token required')
        raw = request(f'sessions/{args.session_id}.json', token)
        if not isinstance(raw, dict) or raw.get('id') != args.session_id or not completed(raw):
            raise RuntimeError('Session identity or completed dates could not be verified')
        chart = request(f'sessions/{args.session_id}/chart.json', token)
        if not isinstance(chart,list): raise ValueError('Unexpected FireBoard chart format; no export written')
        session = {key: raw.get(key) for key in ['id','title','start_time','end_time','description']}
        body = {'format':'ldcooklog-fireboard-completed','version':1,'session':session,'chart':chart}
        args.output.parent.mkdir(parents=True,exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix='.fireboard-',dir=args.output.parent)
        try:
            with os.fdopen(fd,'w') as file:
                json.dump(body,file,ensure_ascii=False,allow_nan=False);file.flush();os.fsync(file.fileno())
            # Exclusive destination creation prevents concurrent overwrite.
            os.link(temporary,args.output)
        finally:
            os.unlink(temporary)
    except RuntimeError as error:
        print('Export stopped:', str(error));return 1
    except (ValueError, OSError, EOFError, KeyboardInterrupt):
        print('Export stopped: cancelled or data/file operation failed. Existing files kept.');return 1
    print('Private completed-session export saved. Import it into the selected cook.')
    print('File:', args.output.name)
    if args.interactive:
        print('Location: iCloud Drive > LDCookLog Backups. Password and token were not saved.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
