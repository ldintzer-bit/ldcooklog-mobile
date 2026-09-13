from pathlib import Path

index = Path('index.html')
text = index.read_text()

replacements = {
    "automatic refresh every 30 seconds": "automatic refresh every 60 seconds",
    "setInterval(() => syncActiveFireboard(false), 30000);": "setInterval(() => syncActiveFireboard(false), 60000);",
    "LDCookLog Mobile V1.23.1": "LDCookLog Mobile V1.23.2",
    "V1.23.1 Stateful BBQ Control Panel": "V1.23.2 Stateful BBQ Control Panel",
    "V1.23.1 begins active FireBoard integration: one active FireBoard session is linked directly to one active LDCookLog cook, new samples are stored automatically, and the live graph refreshes during the cook. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13Q</strong>": "V1.23.2 improves active FireBoard detection using real-time device temperatures and refreshes once per minute to stay within FireBoard API limits. Historical analysis remains paused while we collect clean cook data.<br><strong>Build 2026-09-13R</strong>",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Missing expected text: {old}')
    text = text.replace(old, new, 1)

index.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-23-1';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-23-2';"
if old_cache not in sw_text:
    raise SystemExit('Missing expected V1.23.1 cache name')
sw.write_text(sw_text.replace(old_cache, new_cache, 1))
