// Scriptable FileManager APIs only. No database, credentials or network requests.
// Injectable validator runs the shared recovery/migration checks in WebView.
function createStorage({local, cloud, verify, uuid, namespace = 'development'}) {
  if (!['development','restore-check'].includes(namespace)) throw Error('Unsupported journal namespace');
  const isolated = namespace === 'restore-check';
  const localName = isolated ? 'LDCookLog-2-Restore-Check' : 'LDCookLog-2-Development';
  const cloudName = isolated ? 'LDCookLog-2-Restore-Check-Recovery' : 'LDCookLog-2-Development-Recovery';
  const root = local.joinPath(local.documentsDirectory(), localName);
  local.createDirectory(root, true);
  const journal = local.joinPath(root, 'journal');
  local.createDirectory(journal, true);
  const identity = local.joinPath(root, 'device-id');
  const validID = value => /^[a-f0-9-]{36}$/i.test(value);
  let device = local.fileExists(identity) ? local.readString(identity) : uuid();
  if (!validID(device)) throw Error('Invalid device identity; do not reset files.');
  if (!local.fileExists(identity)) local.writeString(identity, device);
  const marker = local.joinPath(root, 'initialized');
  const pattern = /^(\d{16})-([a-f0-9-]{36})\.recovery\.json$/i;
  const entries = () => local.listContents(journal).filter(n => pattern.test(n)).sort().reverse();
  const rev = name => Number(name.match(pattern)[1]);
  const safeRev = value => Number.isSafeInteger(value) && value >= 1;
  let queue = Promise.resolve();
  const serialized = work => {
    const task = queue.then(work);
    queue = task.catch(() => {});
    return task;
  };
  async function read() {
    const files = entries();
    if (!files.length) {
      if (local.fileExists(marker)) throw Error('Journal files are missing. Restore a snapshot; no reset was performed.');
      return null;
    }
    if (!safeRev(rev(files[0]))) throw Error('Invalid journal revision');
    if (files.length > 1 && rev(files[0]) === rev(files[1])) throw Error('Concurrent journals conflict. Choose a recovery snapshot.');
    const text = local.readString(local.joinPath(journal, files[0]));
    const body = await verify(text);
    if (body.revision !== rev(files[0])) throw Error('Journal revision mismatch');
    return text;
  }
  async function append(text, expectedRevision, repair = false) {
    const body = await verify(text);
    let revision;
    if (repair) {
      // A reviewed snapshot may replace a damaged newest entry explicitly.
      const files = entries();
      revision = files.length ? rev(files[0]) : 0;
      if (!Number.isSafeInteger(revision)) throw Error('Invalid local revision');
      revision++;
      text = await repair(text, revision);
      const repaired = await verify(text);
      if (repaired.revision !== revision) throw Error('Invalid repaired revision');
    } else {
      const current = await read();
      const before = current ? (await verify(current)).revision : 0;
      if (!Number.isSafeInteger(expectedRevision) || before !== expectedRevision || body.revision !== before + 1) throw Error('Journal changed; reopen before saving.');
      revision = body.revision;
    }
    const id = uuid();
    if (!validID(id)) throw Error('Invalid snapshot identity');
    const name = String(revision).padStart(16, '0') + '-' + id + '.recovery.json';
    const target = local.joinPath(journal, name);
    if (local.fileExists(target)) throw Error('Snapshot collision; no file replaced');
    // Never overwrite a journal or keep a mutable primary. An interrupted write
    // leaves an explicit recovery condition instead of quietly losing a save.
    local.writeString(marker, 'ldcooklog-scriptable-v1');
    local.writeString(target, text);
    if (local.readString(target) !== text) throw Error('Snapshot readback failed; recover before continuing.');
    await verify(local.readString(target));
    await read(); // Detect a competing same-revision writer before reporting success.
    return true;
  }
  function cloudRoot() {
    const base = cloud.joinPath(cloud.documentsDirectory(), cloudName);
    cloud.createDirectory(base, true);
    return base;
  }
  async function backupStatus() {
    const files = entries();
    let staged = 0, failed = 0;
    try {
      const destination = cloud.joinPath(cloudRoot(), device);
      cloud.createDirectory(destination, true);
      for (const name of files) {
        try {
          const text = local.readString(local.joinPath(journal, name));
          await verify(text);
          const path = cloud.joinPath(destination, name);
          if (!cloud.fileExists(path)) cloud.writeString(path, text);
          // Do not force a download during a save/retry: it can block offline.
          if (!cloud.isFileDownloaded(path) || cloud.readString(path) !== text) throw Error('Cloud copy is not locally verifiable');
          staged++;
        } catch { failed++; }
      }
    } catch { failed = files.length; }
    return {local: files.length, uploaded: 0, pending: files.length,
      message: `${staged} copies staged in iCloud Drive; ${failed} could not be staged. Upload completion is unconfirmed. Verify recovery on your Mac.`};
  }
  const tokens = new Map();
  async function listSnapshots() {
    tokens.clear();
    const found = [];
    function add(manager, path, label) {
      const token = String(found.length);
      tokens.set(token, {manager, path});
      found.push({token, label});
    }
    for (const name of entries()) add(local, local.joinPath(journal, name), `This iPhone · revision ${rev(name)}`);
    try {
      const bases = [cloudRoot()];
      // Read original iCloud snapshots for the isolated trial. No original
      // local journal is read and no file is written to the source cloud root.
      if (isolated) bases.push(cloud.joinPath(cloud.documentsDirectory(), 'LDCookLog-2-Development-Recovery'));
      for (const base of bases) {
      if (!cloud.fileExists(base)) continue;
      for (const id of cloud.listContents(base).filter(validID)) {
        const dir = cloud.joinPath(base, id);
        if (!cloud.isDirectory(dir)) continue;
        for (const name of cloud.listContents(dir).filter(n => pattern.test(n)).sort().reverse()) {
          add(cloud, cloud.joinPath(dir, name), `iCloud copy (upload unconfirmed) · revision ${rev(name)} · device ${id.slice(0,8)}`);
        }
      }
      }
    } catch { /* Local recovery remains available when iCloud is unavailable. */ }
    return found;
  }
  async function readSnapshot(token) {
    const source = tokens.get(token);
    if (!source) throw Error('Unknown recovery selection; browse again');
    if (source.manager === cloud) await cloud.downloadFileFromiCloud(source.path);
    const text = source.manager.readString(source.path);
    await verify(text);
    return text;
  }
  return {
    read: () => serialized(read),
    commit: (text, expectedRevision) => serialized(() => append(text, expectedRevision)),
    repair: (text, reseal) => serialized(() => append(text, null, reseal)),
    backupStatus: () => serialized(backupStatus),
    listSnapshots: () => serialized(listSnapshots),
    readSnapshot: token => serialized(() => readSnapshot(token))
  };
}
module.exports = {createStorage};
