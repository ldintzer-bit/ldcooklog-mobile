/* LDCookLog 2.0 local-first proof of concept. NO production migration. */
export const DB_NAME = 'ldcooklog-local-poc-v1';
import { validateCook, createBackupForRecords, verifyBackup, planRestore } from './backup.js';
const STORE = 'cooks';

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other copies of LDCookLog and try again.'));
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Storage transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Storage transaction was cancelled'));
  });
}
function requestResult(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function listCooks() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const done = transactionDone(tx);
    const result = await requestResult(tx.objectStore(STORE).getAll());
    await done;
    return result.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '') || a.id.localeCompare(b.id));
  } finally { db.close(); }
}
export async function addCook(c) {
  validateCook(c);
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(STORE).add(c); // Refuses overwrite or duplicate IDs.
    await done;
  } finally { db.close(); }
}
export async function appendEvent(id, event) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    const c = await requestResult(store.get(id));
    if (!c) { tx.abort(); throw Error('Cook not found'); }
    c.events.push(event);
    validateCook(c);
    store.put(c);
    await done;
  } finally { db.close(); }
}
export async function createBackup() {
  return createBackupForRecords(await listCooks());
}
export async function restoreBackup(backup) {
  const incoming = await verifyBackup(backup);
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    // Validate every collision before issuing any writes, all in one transaction.
    const existing = await requestResult(store.getAll());
    let plan;
    try { plan = planRestore(existing, incoming); }
    catch (err) { tx.abort(); await done.catch(() => {}); throw err; }
    const additions = plan.additions;
    for (const cook of additions) store.add(cook);
    await done;
    return { added: plan.added, unchanged: plan.unchanged };
  } finally { db.close(); }
}
export function makeCook(food, cooker) {
  return { id: crypto.randomUUID(), food: food.trim(), cooker: cooker.trim(), startedAt: new Date().toISOString(), finishedAt: null, events: [], temperatures: [], notes: '', source: 'LDCookLog 2.0 prototype' };
}
