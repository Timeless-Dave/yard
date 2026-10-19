import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch();await mkdir('docs/audit',{recursive:true});
try {
  for(const [name,options] of [['desktop',{viewport:{width:1440,height:900}}],['phone',devices['iPhone 14']]]) {
    const context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5196/?test=1');await page.locator('#enter-yard').click({timeout:30000});
    // Camera controls must change simulation state, not just accept clicks.
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert((await page.evaluate(()=>window.__yardTest.state())).cameraZoom<1);
    await page.locator('.yard-menu summary').click();await page.locator('#navigate-button').click();
    await page.locator('#destination-search').fill('Student Union');await page.locator('.destination-row').click();
    const routed=await page.evaluate(()=>window.__yardTest.state());assert(routed.route.length>2,'route must have real waypoints');
    await page.screenshot({path:`docs/audit/${name}-mapped-route.png`});
    const door=routed.doors.find(d=>d.name.includes('Union'));
    await page.evaluate(p=>window.__yardTest.place(p.x,p.z),door);await page.waitForTimeout(150);await page.keyboard.press('e');
    await page.waitForFunction(()=>window.__yardTest.state().room==='union');
    await page.screenshot({path:`docs/audit/${name}-union-lobby.png`});
    // Walk the real player toward a side wall; it must stay in the room.
    const before=await page.evaluate(()=>{window.__yardTest.move(-100,0);return window.__yardTest.state().position;});assert(before.x>-14);
    const elevator=await page.evaluate(()=>window.__yardTest.roomZones().find(z=>z.key==='floor-change'));
    await page.evaluate(p=>window.__yardTest.place(p.x,p.z),elevator);await page.waitForTimeout(150);await page.keyboard.press('e');
    await page.waitForFunction(()=>window.__yardTest.state().level===1);
    await page.screenshot({path:`docs/audit/${name}-union-lounge.png`});
    await page.getByRole('button',{name:'Exit building',exact:true}).click();
    const returned=await page.evaluate(()=>window.__yardTest.state());assert.equal(returned.room,null);assert(Math.hypot(returned.position.x-door.x,returned.position.z-door.z)<.1);
    const library=returned.doors.find(d=>d.name.includes('Library'));
    await page.evaluate(p=>window.__yardTest.place(p.x,p.z),library);await page.waitForTimeout(150);await page.keyboard.press('e');await page.waitForFunction(()=>window.__yardTest.state().room==='library');
    await page.screenshot({path:`docs/audit/${name}-library-interior.png`});
    await page.getByRole('button',{name:'Exit building',exact:true}).click();
    await page.evaluate(()=>window.__yardTest.impact());await page.waitForFunction(()=>window.__yardTest.state().hitTime>0,{timeout:5000});
    await page.screenshot({path:`docs/audit/${name}-vehicle-impact.png`});
    await page.waitForFunction(()=>window.__yardTest.state().hitTime===0,{timeout:5000});
    await page.evaluate(()=>window.__yardTest.recover());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log(`${name}: routes, camera state, door entry/exit, floor change, room walls, vehicle impact/recovery, overflow and runtime passed`);
    await context.close();
  }
}finally{await browser.close();await server.close();}
