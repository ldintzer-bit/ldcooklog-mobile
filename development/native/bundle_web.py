"""Bundle dependency-free ES modules for WKWebView file URLs. No network tools."""
from pathlib import Path
import re
root = Path(__file__).parent / 'Web'
parts = []
for name in ['backup.js', 'migration.js', 'recovery.js', 'app.js']:
    text = (root / name).read_text()
    text = re.sub(r'^import .*?;\s*$', '', text, flags=re.M)
    text = re.sub(r'\bexport (?=(?:async )?(?:function|class|const))', '', text)
    parts.append(text)
(root / 'app.bundle.js').write_text("'use strict';\n(() => {\n" + '\n'.join(parts) + '\n})();\n')
