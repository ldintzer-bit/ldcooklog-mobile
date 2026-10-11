import { listCooks, addCook, appendEvent, createBackup, restoreBackup, makeCook } from './db.js';
import { migrateRelationalExport, RELATIONAL_FORMAT } from './migration.js';
import { createBackupForRecords } from './backup.js';
const $ = id => document.getElementById(id);
const fmt = iso => new Date(iso).toLocaleString();
const status = (message, failure = false) => { $('status').textContent = message; $('status').dataset.error = failure ? 'true' : 'false'; };
let currentId = null;
async function render() {
  const cooks = await listCooks();
  $('count').textContent = `${cooks.length} locally stored cook${cooks.length === 1 ? '' : 's'}`;
  $('list').replaceChildren();
  for (const cook of cooks) {
    const article = document.createElement('article');
    const name = document.createElement('strong'); name.textContent = cook.food || 'Unnamed cook';
    const desc = document.createElement('p'); desc.textContent = `${cook.cooker} · ${fmt(cook.startedAt)} · ${cook.events.length} event(s), ${cook.temperatures.length} temperature samples`;
    const button = document.createElement('button'); button.textContent = 'Open';
    button.addEventListener('click', () => { currentId = cook.id; renderActive(cook); });
    article.append(name, desc, button); $('list').append(article);
  }
  if (currentId) {
    const cook = cooks.find(c => c.id === currentId);
    if (cook) renderActive(cook);
  }
}
function renderActive(cook) {
  $('current').hidden = false;
  $('currentTitle').textContent = `${cook.food} · ${cook.cooker}`;
  $('events').replaceChildren();
  for (const event of cook.events) {
    const item = document.createElement('li');
    item.textContent = `${fmt(event.at)} — ${event.type}${event.note ? ': ' + event.note : ''}`;
    $('events').append(item);
  }
}
$('newCook').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const cook = makeCook($('food').value, $('cooker').value);
    await addCook(cook); currentId = cook.id; $('food').value = ''; await render(); status('Cook saved on this device.');
  } catch (err) { status('Save failed: ' + err.message, true); }
});
$('addEvent').addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentId) return;
  try {
    await appendEvent(currentId, { at: new Date().toISOString(), type: $('eventType').value, note: $('eventNote').value.trim() });
    $('eventNote').value = ''; await render(); status('Event saved locally.');
  } catch (err) { status('Event save failed: ' + err.message, true); }
});
$('backup').addEventListener('click', async () => {
  try {
    const backup = await createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = href; link.download = `LDCookLog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30000);
    status(`Backup prepared with ${backup.count} cooks. Save the downloaded file to iCloud Drive using Files/Share. The app cannot verify that you saved the file.`);
  } catch (err) { status('Backup failed: ' + err.message, true); }
});
$('restore').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 100 * 1024 * 1024) throw Error('Backup file too large');
    const data = JSON.parse(await file.text());
    const isRelational = data.format === RELATIONAL_FORMAT;
    const prepared = isRelational ? await migrateRelationalExport(data) : null;
    const incoming = isRelational ? await createBackupForRecords(prepared.cooks) : data;
    const type = isRelational ? `Supabase migration of ${prepared.cooks.length} cooks` : 'local backup';
    if (!confirm(`Import ${type} from ${file.name}? Existing cooks will never be overwritten. Exact duplicates are skipped; any conflict cancels the entire import. This is a test app, NOT the production cook logger.`)) return;
    const result = await restoreBackup(incoming); await render();
    status(`Import complete: ${result.added} new, ${result.unchanged} already present. Export a new local backup before relying on this device. ${isRelational ? 'Keep the original .dump and .relational.json files.' : ''}`);
  } catch (err) { status('Restore refused: ' + err.message, true); }
  finally { e.target.value = ''; }
});
(async () => {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
    await render(); status('Prototype ready. No Supabase or FireBoard credentials are used.');
  } catch (err) { status('Storage unavailable: ' + err.message, true); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(err => status('Offline installation unavailable: ' + err.message, true));
})();
