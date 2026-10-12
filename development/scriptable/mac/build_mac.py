"""Bundle the reviewed auditor and worker into one offline installable Python file."""
from pathlib import Path

root = Path(__file__).parent
audit = (root / 'reconcile_private_history.py').read_text()
entry = "if __name__ == '__main__':\n    raise SystemExit(main())"
assert audit.count(entry) == 1
audit = audit.replace(entry, '')
worker = (root / 'maintain_verified_recovery.py').read_text()
dependency = 'from reconcile_private_history import AuditFailure, BASE, DEVICE, NAME, canonical, latest_journals, require, snapshot, source_archive, iso\n'
assert worker.count(dependency) == 1
worker = worker.replace(dependency, '')
(root / 'LDCookLog-Mac-Recovery.py').write_text('# Generated offline Mac recovery worker. No downloads performed by this program.\nLDC_STANDALONE = True\n' + audit + '\n' + worker)
