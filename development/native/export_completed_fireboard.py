"""Mac administration helper. Export one completed session; no Supabase access.

The FireBoard account token is entered invisibly, used in memory only, and is
never written to the export. Save exports outside the public git checkout.
"""
import argparse
import datetime as dt
import getpass
import json
import os
from pathlib import Path
import tempfile
import urllib.request
import urllib.error

def request(path, token):
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    req = urllib.request.Request('https://fireboard.io/api/v1/' + path,
        headers={'Authorization': 'Token ' + token, 'User-Agent':'LDCookLog/2.0 completed-session-export', 'Accept':'application/json'})
    # Never print response bodies or authentication headers on failure.
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'FireBoard request failed (HTTP {error.code}); no export written') from None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session_id', type=int)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.session_id <= 0: parser.error('Session ID must be positive')
    if args.output.exists(): parser.error('Choose a new output filename; existing exports are never overwritten')
    # Reject any output below a git checkout; private cook data cannot be published.
    if any((parent / '.git').exists() for parent in [args.output.resolve().parent, *args.output.resolve().parents]):
        parser.error('Save the private export outside every Git repository')
    token = getpass.getpass('FireBoard API token (hidden; not saved): ').strip()
    if not token: parser.error('Token required')
    try:
        raw = request(f'sessions/{args.session_id}.json', token)
        end = dt.datetime.fromisoformat(str(raw.get('end_time') or '').replace('Z','+00:00'))
        if end.tzinfo is None or end > dt.datetime.now(dt.timezone.utc): raise ValueError('Session must be completed')
        # Two serial calls, well below documented 17 requests per five minutes.
        chart = request(f'sessions/{args.session_id}/chart.json', token)
        if not isinstance(chart,list): raise ValueError('Unexpected FireBoard chart format; no export written')
        session = {key: raw.get(key) for key in ['id','title','start_time','end_time','description']}
        body = {'format':'ldcooklog-fireboard-completed','version':1,'session':session,'chart':chart}
        args.output.parent.mkdir(parents=True,exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix='.fireboard-',dir=args.output.parent)
        try:
            with os.fdopen(fd,'w') as file:
                json.dump(body,file,ensure_ascii=False);file.flush();os.fsync(file.fileno())
            # Exclusive destination creation prevents concurrent overwrite.
            os.link(temporary,args.output)
        finally:
            os.unlink(temporary)
    except (ValueError,RuntimeError,OSError) as error:
        print('Export stopped:', str(error));return 1
    print('Private completed-session export saved. Import it into the selected cook.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
