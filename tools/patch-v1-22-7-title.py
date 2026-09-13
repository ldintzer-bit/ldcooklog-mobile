from pathlib import Path

path = Path('index.html')
text = path.read_text()
old = "document.title = 'LDCookLog Mobile V1.22.6';"
new = "document.title = 'LDCookLog Mobile V1.22.7';"
if old not in text:
    raise SystemExit('V1.22.7 document-title anchor not found')
path.write_text(text.replace(old, new, 1))
print('V1.22.7 document title updated.')
