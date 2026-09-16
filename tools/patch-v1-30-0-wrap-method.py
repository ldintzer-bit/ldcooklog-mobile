# Compatibility launcher retained because the existing GitHub Actions workflow
# watches this path. V1.30.0 is already deployed; current work is V1.30.1.
from pathlib import Path

patch = Path('tools/patch-v1-30-1-sync-hotfix.py')
if not patch.exists():
    raise SystemExit('V1.30.1 patcher not found')
exec(compile(patch.read_text(encoding='utf-8'), str(patch), 'exec'))
