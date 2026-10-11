// Embedded before the app; no native credentials or private files in the page.
(() => {
  const queue = [], pending = new Map();
  let next = 1, receiver;
  window.ldcooklogHost = {postMessage(body) {
    if (pending.size >= 64) return Promise.reject(Error('Too many queued operations'));
    return new Promise((resolve,reject) => {
      const id = next++;
      pending.set(id,{resolve,reject});
      queue.push({id,body});
      if (receiver) { const deliver = receiver; receiver = null; deliver(queue.shift()); }
    });
  }};
  window.__ldcTake = callback => {
    if (queue.length) callback(queue.shift()); else receiver = callback;
  };
  window.__ldcDeliver = ({id,result,error}) => {
    const task = pending.get(id);
    if (!task) throw Error('Unknown host reply');
    pending.delete(id);
    if (error) task.reject(Error(error)); else task.resolve(result);
  };
})();
