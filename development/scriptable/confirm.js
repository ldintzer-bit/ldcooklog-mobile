// Visible in-page confirmation; no dependency on native WebView dialogs.
(() => {
  let active = false;
  window.__ldcConfirm = message => {
    if (active) return Promise.reject(Error('A confirmation is already open'));
    active = true;
    return new Promise(resolve => {
      const previous = document.activeElement;
      const siblings = [...document.body.children].map(node => ({node, inert:node.inert}));
      for (const {node} of siblings) node.inert = true;
      const panel = document.createElement('section');
      panel.id = 'ldc-confirm';
      panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
      panel.setAttribute('aria-labelledby','ldc-confirm-title');
      const card = document.createElement('div'), title = document.createElement('h2'), text = document.createElement('p');
      card.className = 'ldc-confirm-card'; title.id = 'ldc-confirm-title'; title.textContent = 'Confirm journal change';
      text.textContent = message;
      const yes = document.createElement('button'), no = document.createElement('button');
      yes.id = 'ldc-confirm-yes'; no.id = 'ldc-confirm-no';
      yes.textContent = message.startsWith('Restore ') ? 'Restore recovery copy' : message.startsWith('Finish ')?'Finish cook':message.startsWith('Discard ')?'Discard unsaved drafts':'Import database export';
      no.textContent = 'Cancel';
      function finish(answer) {
        panel.remove(); active = false; document.removeEventListener('keydown',escape);
        for (const {node,inert} of siblings) node.inert = inert;
        if (previous?.isConnected) previous.focus();
        resolve(answer);
      }
      function escape(event) { if (event.key === 'Escape') { event.preventDefault(); finish(false); } }
      yes.onclick = () => finish(true); no.onclick = () => finish(false);
      document.addEventListener('keydown',escape);
      card.append(title,text,yes,no); panel.append(card); document.body.append(panel);
      no.focus();
    });
  };
})();
