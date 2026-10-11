import {webcrypto} from 'node:crypto';
import {seal,unseal} from '../Web/recovery.js';
globalThis.crypto ||= webcrypto;
if (process.argv[2] === 'verify') {
  let text=''; for await (const chunk of process.stdin) text+=chunk;
  const body=await unseal(JSON.parse(text));
  if (body.state.records[0].notes !== 'café 🍖 日本語') throw Error('Unicode did not survive native storage');
  process.stdout.write('verified');
} else {
  const state={records:[{id:'synthetic-cross-format',food:'Synthetic',cooker:'Weber',startedAt:'2026-01-01T00:00:00Z',finishedAt:null,notes:'café 🍖 日本語',events:[],temperatures:[]}],relationalArchives:[]};
  process.stdout.write(JSON.stringify(await seal(state,1)));
}
