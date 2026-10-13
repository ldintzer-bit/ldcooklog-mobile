// Scriptable FileManager APIs only. No database, credentials or network requests.
// Injectable validator runs the shared recovery/migration checks in WebView.
function createStorage({local, cloud, verify, uuid, namespace = 'development', waitForDownload = work => work(), waitForVerification = work => work()}) {
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
    let files = entries();
    let staged = 0, failed = 0, current = null;
    try {
      const destination = cloud.joinPath(cloudRoot(), device);
      cloud.createDirectory(destination, true);
      for (const name of files) {
        try {
          const text = local.readString(local.joinPath(journal, name));
          await verify(text);
          if (name === files[0]) current = {revision:rev(name), sha256:JSON.parse(text).sha256};
          const path = cloud.joinPath(destination, name);
          if (!cloud.fileExists(path)) cloud.writeString(path, text);
          // Do not force a download during a save/retry: it can block offline.
          if (!cloud.isFileDownloaded(path) || cloud.readString(path) !== text) throw Error('Cloud copy is not locally verifiable');
          staged++;
        } catch { failed++; }
      }
    } catch { failed = files.length; }
    // Local verification does not depend on successful cloud staging.
    if (!current && files.length) {
      try { const text=local.readString(local.joinPath(journal,files[0]));await verify(text);current={revision:rev(files[0]),sha256:JSON.parse(text).sha256}; }
      catch { /* A damaged newest journal cannot gain proof from an older copy. */ }
    }
    const mac = await macVerification(current);
    let retention = 'Older snapshots kept until current Mac verification is available.';
    if (mac.verified && !failed) {
      try { retention = await retainSnapshots(files); files = entries(); staged = files.length; }
      catch { retention = 'Snapshot cleanup paused; current recovery copies remain available.'; }
    }
    let bytes = 0;
    for (const name of files) { try { bytes += encodeURIComponent(local.readString(local.joinPath(journal,name))).replace(/%[A-F0-9]{2}/g,'x').length; } catch {} }
    const capacity = `Local snapshots use about ${Math.ceil(bytes/1048576)} MiB.` + (bytes >= 128*1048576 ? ' Storage warning: over 128 MiB. Keep the Mac awake for verification and cleanup.' : '');
    return {local: files.length, uploaded: 0, pending: files.length, failed, storageWarning:bytes >= 128*1048576, mac,
      message: `${staged} copies staged in iCloud Drive; ${failed} could not be staged. Upload completion is unconfirmed. ${mac.message} ${retention} ${capacity}`};
  }
  async function retainSnapshots(files) {
    if (files.length <= 20) return 'Recovery retention is within its 20-recent-copy target.';
    // Only this device/namespace, after proof of its exact newest snapshot.
    const keep = new Set([...files.slice(0,20), files.at(-1)]), archives = new Set(), revisions = new Set(), candidates = [];
    const destination=cloud.joinPath(cloudRoot(),device);
    for (const name of files) {
      const path=local.joinPath(journal,name), text=local.readString(path), body=await verify(text);
      if (body.revision !== rev(name) || revisions.has(body.revision)) throw Error('Conflicting retention revisions');
      revisions.add(body.revision);
      for (const archive of JSON.parse(JSON.parse(text).payload).state.relationalArchives) {
        if (!archives.has(archive.sha256)) { keep.add(name); archives.add(archive.sha256); }
      }
      const cloudPath=cloud.joinPath(destination,name);
      if (!cloud.isFileDownloaded(cloudPath) || cloud.readString(cloudPath)!==text) throw Error('Cloud bytes unavailable');
      candidates.push({name,path,cloudPath,text});
    }
    // Validate every eligible copy before removing any. Never touch another
    // device, the independent Mac copies, or original database exports.
    for (const row of candidates) {
      if (local.readString(row.path)!==row.text || cloud.readString(row.cloudPath)!==row.text) throw Error('Snapshot changed');
    }
    let count=0;
    for (const row of candidates) if (!keep.has(row.name)) {
      cloud.remove(row.cloudPath);
      local.remove(row.path);
      count++;
    }
    return `${count} older snapshot pairs removed after Mac verification; first, recent and source-archive recovery points kept.`;
  }
  async function macVerification(current) {
    const missing = {verified:false, message:'Mac independent-copy report is not available yet.'};
    try {
      const folder=cloud.joinPath(cloud.joinPath(cloud.documentsDirectory(),'LDCookLog-2-Mac-Verification'),namespace);
      const path=cloud.joinPath(folder,device+'.json');
      if (!cloud.fileExists(path)) return missing;
      if (!cloud.isFileDownloaded(path)) await waitForVerification(()=>cloud.downloadFileFromiCloud(path));
      const text=cloud.readString(path);
      if (text.length>4096) throw Error('Oversized report');
      const report=JSON.parse(text), checked=Date.parse(report.checkedAt), verified=Date.parse(report.verifiedAt);
      const timestamp=value=>typeof value==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value);
      if (report.format!=='ldcooklog-mac-copy-report' || report.version!==1 || report.namespace!==namespace || report.device!==device ||
          !['verified','failed'].includes(report.health) || !['manual','scheduled'].includes(report.trigger) || !safeRev(report.revision) ||
          typeof report.sha256!=='string' || !/^[a-f0-9]{64}$/.test(report.sha256) || !timestamp(report.checkedAt) || !timestamp(report.verifiedAt) || !Number.isFinite(checked) || !Number.isFinite(verified) ||
          checked>Date.now()+300000 || verified>Date.now()+300000 || verified>checked+300000) throw Error('Invalid report');
      if (report.health==='failed') return {verified:false,health:'failed',revision:report.revision,message:`Mac reported a failed backup attempt. Last independently verified copy: revision ${report.revision}.`};
      if (Date.now()-checked>900000) return {verified:false,revision:report.revision,message:`Mac report is over 15 minutes old. Last verified copy: revision ${report.revision}. Keep the Mac awake to refresh it.`};
      if (!current || report.revision!==current.revision || report.sha256!==current.sha256)
        return {verified:false,revision:report.revision,message:`Mac last verified revision ${report.revision}. This journal is awaiting an independent Mac copy.`};
      const capacity = report.capacity;
      const capacityNote = capacity && Number.isSafeInteger(capacity.bytes) && capacity.bytes >= 0 && Number.isSafeInteger(capacity.limit) && capacity.limit > 0 ? ` Mac backup storage: ${Math.ceil(capacity.bytes/1048576)} of ${Math.ceil(capacity.limit/1048576)} MiB.${capacity.bytes >= capacity.limit*.8 ? ' Storage warning: over 80% of the limit.' : ''}` : '';
      return {verified:true,revision:report.revision,message:`Mac independent copy verified for this revision (${report.revision}) at ${new Date(verified).toLocaleString()}.${capacityNote}`};
    } catch {
      return {verified:false,message:'Mac verification report is unavailable or could not be validated. Local snapshots remain available.'};
    }
  }
  const tokens = new Map();
  async function listSnapshots() {
    tokens.clear();
    const found = [];
    function add(manager, path, label, revision) {
      const token = String(found.length);
      tokens.set(token, {manager, path, revision});
      found.push({token, label});
    }
    for (const name of entries()) add(local, local.joinPath(journal, name), `This iPhone · revision ${rev(name)}`, rev(name));
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
          add(cloud, cloud.joinPath(dir, name), `iCloud copy (upload unconfirmed) · revision ${rev(name)} · device ${id.slice(0,8)}`, rev(name));
        }
      }
      }
    } catch { /* Local recovery remains available when iCloud is unavailable. */ }
    return found;
  }
  async function readSnapshot(token) {
    const source = tokens.get(token);
    if (!source) throw Error('Unknown recovery selection; browse again');
    if (source.manager === cloud && !cloud.isFileDownloaded(source.path)) await waitForDownload(() => cloud.downloadFileFromiCloud(source.path));
    const text = source.manager.readString(source.path);
    const body = await verify(text);
    if (body.revision !== source.revision) throw Error('Recovery snapshot revision mismatch');
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
