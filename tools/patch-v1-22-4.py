from pathlib import Path

path = Path('index.html')
text = path.read_text()

old_mark_block = """  function markExistingFireboardAssociations(sessionIds) {\n    const attached = new Set((sessionIds || []).map(String));\n    fireboardList.querySelectorAll('button[data-fireboard-session-id]').forEach(button => {\n      if (attached.has(String(button.dataset.fireboardSessionId))) {\n        button.textContent = 'Attached to Current Cook';\n        button.disabled = true;\n        const inspect = button.parentElement?.querySelector(`button[data-fireboard-inspect-id=\"${button.dataset.fireboardSessionId}\"]`);\n        if (inspect) inspect.disabled = false;\n        const importButton = button.parentElement?.querySelector(`button[data-fireboard-import-id=\"${button.dataset.fireboardSessionId}\"]`);\n        if (importButton) importButton.disabled = false;\n      }\n    });\n  }\n"""

new_mark_block = old_mark_block + """\n  async function markFireboardImportStatuses(accessToken, sessionIds) {\n    for (const sessionId of sessionIds || []) {\n      try {\n        const association = await getFireboardAssociation(accessToken, sessionId);\n        if (!association?.id) continue;\n        const count = await verifyFireboardSampleCount(accessToken, association.id);\n        if (!Number.isFinite(count) || count <= 0) continue;\n        const importButton = fireboardList.querySelector(`button[data-fireboard-import-id=\"${String(sessionId)}\"]`);\n        if (importButton) {\n          importButton.textContent = `Temperature Data Imported — ${count} samples`;\n          importButton.disabled = false;\n        }\n      } catch (_) {\n        // Import-status lookup is optional. Leave the normal import button available if it fails.\n      }\n    }\n  }\n"""

if 'async function markFireboardImportStatuses' not in text:
    if old_mark_block not in text:
        raise SystemExit('Could not find FireBoard association marker block.')
    text = text.replace(old_mark_block, new_mark_block, 1)

old_call = """        markExistingFireboardAssociations(attachedIds);\n      }\n      const attachedCount = sessions.filter(row => attachedIds.includes(String(row.id))).length;\n"""
new_call = """        markExistingFireboardAssociations(attachedIds);\n        await markFireboardImportStatuses(session.access_token, attachedIds);\n      }\n      const attachedCount = sessions.filter(row => attachedIds.includes(String(row.id))).length;\n"""
if 'await markFireboardImportStatuses(session.access_token, attachedIds);' not in text:
    if old_call not in text:
        raise SystemExit('Could not find FireBoard load association call.')
    text = text.replace(old_call, new_call, 1)

old_success_button = "      button.textContent = 'Temperature Data Imported';\n"
new_success_button = "      button.textContent = verifiedCount == null ? 'Temperature Data Imported' : `Temperature Data Imported — ${verifiedCount} samples`;\n"
if old_success_button in text:
    text = text.replace(old_success_button, new_success_button, 1)
elif new_success_button not in text:
    raise SystemExit('Could not find FireBoard import success button text.')

text = text.replace(
    'V1.22.4 can securely import FireBoard temperature samples for sessions attached to the current cook. Imports are retry-safe and verified in cloud storage.',
    'V1.22.5 remembers FireBoard temperature-import status after refresh and shows the verified cloud sample count for attached sessions.',
    1
)
text = text.replace("document.title = 'LDCookLog Mobile V1.22.4';", "document.title = 'LDCookLog Mobile V1.22.5';", 1)
text = text.replace("headerSub.textContent = 'V1.22.4 Stateful BBQ Control Panel';", "headerSub.textContent = 'V1.22.5 Stateful BBQ Control Panel';", 1)
text = text.replace(
    "V1.22.4 adds retry-safe FireBoard temperature-sample import into Supabase for attached sessions, with cloud verification and correct °F/°C display.<br><strong>Build 2026-09-13K1</strong>",
    "V1.22.5 adds persistent FireBoard import recognition after refresh, including verified cloud sample counts for attached sessions.<br><strong>Build 2026-09-13L</strong>",
    1
)
path.write_text(text)

sw = Path('service-worker.js')
sw_text = sw.read_text()
old_cache = "const CACHE_NAME = 'ldcooklog-v1-22-4a';"
new_cache = "const CACHE_NAME = 'ldcooklog-v1-22-5';"
if old_cache in sw_text:
    sw_text = sw_text.replace(old_cache, new_cache, 1)
elif new_cache not in sw_text:
    raise SystemExit('Could not find current V1.22.4 service worker cache name.')
sw.write_text(sw_text)
