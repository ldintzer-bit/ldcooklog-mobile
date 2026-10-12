// Synthetic bridge/UI tests, not a substitute for native iCloud/device testing.
const {chromium} = require('playwright');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
(async () => {
  let current = null, snapshots = [], available = false;
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await context.exposeBinding('testNative',async (_,{operation,text,expectedRevision,token}) => {
      if (operation === 'read') {
        if (current === 'broken') throw Error('Damaged recovery file');
        return current;
      }
      if (operation === 'commit' || operation === 'repair') {
        const envelope = JSON.parse(text), body = JSON.parse(envelope.payload);
        assert.equal(createHash('sha256').update(envelope.payload).digest('hex'),envelope.sha256);
        if (operation === 'commit') assert.equal(current ? JSON.parse(JSON.parse(current).payload).revision : 0,expectedRevision);
        snapshots.push(text); current = text; return true;
      }
      if (operation === 'backupStatus') return {local:snapshots.length,uploaded:available?snapshots.length:0,pending:available?0:snapshots.length,message:available?'Uploaded':'iCloud unavailable'};
      if (operation === 'listSnapshots') return snapshots.map((_,i)=>({token:String(i),label:'Synthetic snapshot '+i}));
      if (operation === 'readSnapshot') return snapshots[Number(token)];
      throw Error('Unknown test operation');
    });
    await context.addInitScript(() => { window.webkit = {messageHandlers:{recovery:{postMessage:body=>window.testNative(body)}}}; });
    const page = await context.newPage();
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(pathToFileURL(path.resolve(__dirname,'../Web/index.html')).href);
    await page.locator('#status').filter({hasText:'Journal ready'}).waitFor();
    await page.locator('#food').fill('Synthetic ribs'); await page.locator('#new button').click();
    await page.locator('#count').filter({hasText:'1 of 1'}).waitFor();
    await page.locator('#history button').click();
    for (const type of ['Meat On','Wrapped','Rest Start','Keep Warm','Cook Finished']) {
      await page.locator('#type').selectOption(type); await page.locator('#event button').click();
      await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    }
    assert.equal(JSON.parse(JSON.parse(current).payload).state.records[0].events.length,5);
    assert.equal(snapshots.length,6);
    await context.setOffline(true); await page.reload();
    await page.locator('#history').filter({hasText:'Synthetic ribs'}).waitFor();
    assert.match(await page.locator('#protection').innerText(),/6 pending/);
    available = true; await page.locator('#retry').click();
    await page.locator('#protection').filter({hasText:'6 confirmed uploaded'}).waitFor();
    current = 'broken'; await page.reload();
    await page.locator('#status').filter({hasText:'no data was reset'}).waitFor();
    assert.equal(await page.locator('#new button').isDisabled(),true);
    await page.locator('#browse').click();
    await page.locator('#snapshots button').first().click();
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    assert.equal(JSON.parse(JSON.parse(current).payload).state.records[0].events.length,0);
    assert.equal(snapshots.length,7);
    await page.locator('#history button').click();
    await page.locator('#editPreparation').fill('Synthetic dry brine');
    await page.locator('#methodChoice').selectOption('No wrap');
    await page.locator('#equipmentChoice').selectOption('__custom__');
    await page.locator('#editEquipment').fill('Synthetic kettle');
    await page.locator('#editRating').selectOption('4');
    await page.locator('#editTest').check();
    await page.locator('#profileForm button').click();
    await page.waitForFunction(()=>!document.querySelector('#profileForm button').disabled);
    await page.locator('#count').filter({hasText:'0 of 1'}).waitFor();
    await page.locator('#showTests').check();
    await page.locator('#history button').waitFor();
    await page.reload();
    await page.locator('#showTests').check();
    await page.locator('#history button').click();
    assert.equal(await page.locator('#editPreparation').inputValue(),'Synthetic dry brine');
    assert.equal(await page.locator('#editEquipment').inputValue(),'Synthetic kettle');
    assert.equal(await page.locator('#equipmentChoice').inputValue(),'__custom__');
    assert.equal(await page.locator('#equipmentCustom').isVisible(),true);
    assert.equal(await page.locator('#methodChoice').inputValue(),'No wrap');
    assert.equal(await page.locator('#methodCustom').isVisible(),false);
    assert.equal(await page.locator('#editRating').inputValue(),'4');
    await page.locator('#methodChoice').selectOption('__custom__');
    await page.locator('#editMethod').fill('Smoke / rest / sear');
    await page.locator('#equipmentChoice').selectOption('Weber kettle, lump charcoal');
    await page.locator('#profileForm button').click();
    await page.waitForFunction(()=>!document.querySelector('#profileForm button').disabled);
    await page.locator('#status').filter({hasText:'Saved on this device'}).waitFor();
    await page.reload();
    await page.locator('#showTests').check();
    await page.locator('#history button').click();
    assert.equal(await page.locator('#methodChoice').inputValue(),'__custom__');
    assert.equal(await page.locator('#editMethod').inputValue(),'Smoke / rest / sear');
    assert.equal(await page.locator('#equipmentChoice').inputValue(),'Weber kettle, lump charcoal');
    assert.equal(await page.locator('#equipmentCustom').isVisible(),false);
    console.log('PASS: method/equipment presets and custom values persist offline with no data conversion.');
    console.log('PASS: cook preparation, equipment, rating and test filtering persist across reopening.');
    console.log('PASS: iPhone-size UI lifecycle, offline reopening, pending/uploaded display, corrupt-primary recovery; native bridge mocked.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
