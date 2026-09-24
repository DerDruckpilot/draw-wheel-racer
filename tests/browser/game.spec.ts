import {test,expect} from '@playwright/test';
import {drawStroke,fitDrawnWheels,snapshot,denseStroke} from './helpers';

async function boot(page:any){
  await page.addInitScript(()=>{if(!localStorage.getItem('formdrive.world.v2'))localStorage.setItem('formdrive.world.v2',JSON.stringify({schema:2,level:0,records:{},runs:{},sound:false,quality:'eco',tutorial:true}));});
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});
}

test('independent square multi-stroke drafts mount explicitly, clear after mounting and preserve installed wheels',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
  expect((await snapshot(page)).mounted).toEqual([[],[]]);await expect(page.locator('[data-shape],.presets,#load-shape')).toHaveCount(0);
  for(const id of ['rear','front']){const r=(await page.locator('#drawing-'+id).boundingBox())!;expect(Math.abs(r.width-r.height)).toBeLessThan(2);}
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','home');
  const before=(await snapshot(page)).axleRevisions;
  await drawStroke(page,'rear',[[-1,0],[-.4,.3]]);await drawStroke(page,'rear',[[.35,-.4],[.9,.2]]);
  expect((await snapshot(page)).axleRevisions).toEqual(before);await page.locator('#mount-rear').click();let s=await snapshot(page);
  expect(s.axleRevisions[0]).toBeGreaterThan(before[0]);expect(s.axleRevisions[1]).toBe(before[1]);expect(s.shapes[0].filter((p:any)=>p.move).length).toBe(1);
  await drawStroke(page,'front',[[-.9,-.2],[0,.8],[.9,-.2]]);await page.locator('#mount-front').click();
  const installed=(await snapshot(page)).shapes;expect((await snapshot(page)).drafts).toEqual([[],[]]);
  await drawStroke(page,'rear',[[-.8,0],[.8,0]]);await page.locator('#undo-rear').click();await expect(page.locator('#mount-rear')).toBeDisabled();
  await page.locator('#clear-front').click();expect((await snapshot(page)).shapes).toEqual(installed);
  await page.locator('#settings-button').click();await expect(page.locator('.version')).toContainText('2.0.0');await page.locator('#close-modal').click();
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  await page.locator('#pause-button').click();const time=(await snapshot(page)).elapsed;await page.waitForTimeout(180);expect((await snapshot(page)).elapsed).toBe(time);await page.locator('#resume-game').click();
  await page.locator('#rescue-button').click();expect((await snapshot(page)).rescues).toBe(1);expect(Object.keys((await snapshot(page)).radar).sort()).toEqual(['angle','band']);
  await page.locator('#pause-button').click();await page.locator('#back-home').click();await expect(page.locator('[data-level]')).toHaveCount(21);expect(errors).toEqual([]);
});

test('physical pedals dose throttle, latch cruise and cancel safely when braking or rotating the phone',async({page})=>{
  await boot(page);await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  const gas=page.locator('[data-pedal="gas"]'),r=(await gas.boundingBox())!;
  await page.mouse.move(r.x+r.width/2,r.y+r.height-12);await page.mouse.down();expect((await snapshot(page)).controls.drive).toBeLessThan(.35);await expect(gas).toHaveClass(/held/);
  await page.mouse.move(r.x+r.width/2,r.y+15,{steps:5});await page.mouse.up();expect((await snapshot(page)).controls.cruise).toBe(true);
  const brake=page.locator('[data-pedal="brake"]');await brake.click();expect((await snapshot(page)).controls.cruise).toBe(false);
  await page.keyboard.down('KeyD');await expect.poll(async()=>(await snapshot(page)).controls.drive).toBe(1);await page.keyboard.up('KeyD');
  await page.setViewportSize({width:440,height:956});await expect(page.locator('#modal-title')).toHaveText('Durchatmen.');expect((await snapshot(page)).controls.drive).toBe(0);
  await page.setViewportSize({width:956,height:440});await page.locator('#resume-game').click();await page.keyboard.down('KeyA');expect((await snapshot(page)).controls.drive).toBeLessThan(0);await page.keyboard.up('KeyA');
});

test('discoveries persist, the goal requires powered generators, and completion records the actual run',async({page})=>{
  await boot(page);await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  await page.evaluate(()=>{const g=(window as any).__FORMDRIVE__,l=g.level();g.inspect(l.goal.x,l.goal.z);g.step(20);});expect((await snapshot(page)).finished).toBe(false);
  await page.evaluate(()=>{const g=(window as any).__FORMDRIVE__,l=g.level();for(const c of l.caches)g.inspect(c.x,c.z);for(const r of l.relays)g.inspect(r.x,r.z);const c=l.camps[0];g.inspect(c.x,c.z,c.yaw);g.resume();});
  await page.locator('#pause-button').click();const saved=await snapshot(page);expect(saved.activatedRelays.length).toBe(2);expect(saved.collected.length).toBe(5);expect(saved.checkpoint).not.toBe('start');
  await page.reload();await expect(page.locator('#start-button')).toHaveText(/Ab Lager fortsetzen/,{timeout:120000});expect((await snapshot(page)).checkpoint).toBe(saved.checkpoint);expect((await snapshot(page)).collected).toEqual(saved.collected);
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  await page.evaluate(()=>{const g=(window as any).__FORMDRIVE__,p=g.level().goal;g.inspect(p.x,p.z);g.resume();});await expect(page.locator('#modal-title')).toHaveText('Im Lager angekommen.');
  await expect(page.locator('.result-stars')).toContainText('★★★');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('formdrive.world.v2')!).records[0].stars)).toBe(3);
  await page.locator('#next-level').click();expect((await snapshot(page)).level).toBe(1);
});

test('PWA cold start, compressed assets and the first complex drawing work offline',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','The service-worker lifecycle is exercised in Chromium.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});await expect(page.locator('#offline-status')).toContainText('OFFLINE BEREIT');
  await denseStroke(page);await page.locator('#mount-rear').click();await expect.poll(async()=>(await snapshot(page)).shapes[0].length,{timeout:30000}).toBeGreaterThan(128);
  const assets=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));expect(assets.some(n=>n.endsWith('/offroad.glb'))).toBe(true);expect(assets.some(n=>n.endsWith('.ktx2'))).toBe(true);
  await context.setOffline(false);expect(errors).toEqual([]);
});
