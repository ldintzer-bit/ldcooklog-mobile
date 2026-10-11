// Embedded before the app; no native credentials or private files in the page.
(() => {
  const queue = [], pending = new Map();
  let next = 1;
  window.__ldcWake = () => { if (window.location) window.location.href = "ldcooklog-bridge://wake"; };
  window.ldcooklogHost = {postMessage(body) {
    if (pending.size >= 64) return Promise.reject(Error('Too many queued operations'));
    return new Promise((resolve,reject) => {
      const id = next++;
      pending.set(id,{resolve,reject});
      queue.push({id,body});
      // A blocked local navigation wakes the host; no request data is in a URL.
      window.__ldcWake();
    });
  }};
  // Native evaluation returns immediately even when there is no UI request.
  // No indefinitely pending native completion callback during presentation.
  window.__ldcTakeNow = () => queue.length ? queue.shift() : null;
  window.__ldcDeliver = ({id,result,error}) => {
    const task = pending.get(id);
    if (!task) throw Error('Unknown host reply');
    pending.delete(id);
    if (error) task.reject(Error(error)); else task.resolve(result);
  };
})();
