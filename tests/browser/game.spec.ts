import {test,expect} from '@playwright/test';
import {drawStroke,fitDrawnWheels,snapshot,denseStroke} from './helpers';

test('landscape drafts require explicit mounting on each axle, with multi-stroke undo and no presets',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
  expect((await snapshot(page)).player.shapes).toEqual([[],[]]);await expect(page.locator('[data-shape],.presets,#load-shape')).toHaveCount(0);
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','home');
  const before=(await snapshot(page)).player.axleRevisions;
  await drawStroke(page,'rear',[[-1,0],[-.4,.3]]);await drawStroke(page,'rear',[[.35,-.4],[.9,.2]]);
  expect((await snapshot(page)).player.axleRevisions).toEqual(before);
  await page.locator('#mount-rear').click();let s=await snapshot(page);
  expect(s.player.axleRevisions[0]).toBeGreaterThan(before[0]);expect(s.player.axleRevisions[1]).toBe(before[1]);expect(s.player.shapes[0].filter((p:any)=>p.move).length).toBe(1);
  await drawStroke(page,'front',[[-.9,-.2],[0,.8],[.9,-.2]]);await page.locator('#mount-front').click();
  const installed=(await snapshot(page)).player.shapes;expect((await snapshot(page)).drafts).toEqual([[],[]]);
  await drawStroke(page,'rear',[[-.8,0],[.8,0]]);expect((await snapshot(page)).drafts[0].some((p:any)=>p.move)).toBe(false);await page.locator('#clear-rear').click();
  await drawStroke(page,'rear',[[0,-.9],[0,.9]]);await page.locator('#undo-rear').click();
  await expect(page.locator('#mount-rear')).toBeDisabled();
  await page.locator('#clear-front').click();expect((await snapshot(page)).player.shapes).toEqual(installed);await expect(page.locator('#mount-front')).toBeDisabled();
  await page.locator('#settings-button').click();await expect(page.locator('.version')).toContainText('1.7.0');await page.locator('#close-modal').click();
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  await page.locator('#pause-button').click();const time=(await snapshot(page)).time;await page.waitForTimeout(150);expect((await snapshot(page)).time).toBe(time);await page.locator('#resume-game').click();
  await page.locator('#rescue-button').click();expect((await snapshot(page)).player.resets).toBe(1);
  await page.evaluate(()=>{(window as any).__FORMDRIVE__.load(2);(window as any).__FORMDRIVE__.water();});
  s=await snapshot(page);expect(s.player.water).toBeGreaterThan(.1);expect(s.spray.count).toBeGreaterThan(100);
  await page.screenshot({path:'.local/v16-water-tested.png'});
  await page.evaluate(()=>(window as any).__FORMDRIVE__.finish());await expect(page.locator('#modal-title')).toHaveText('Im Lager angekommen.');
  await page.locator('#finish-home').click();await expect(page.locator('[data-level]')).toHaveCount(16);expect(errors).toEqual([]);
});

test('countdown uses elapsed time with a slow renderer',async({page,browserName})=>{
  test.skip(browserName!=='webkit','UI clock regression in WebKit.');
  await page.addInitScript(()=>{localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'}));window.requestAnimationFrame=cb=>window.setTimeout(()=>cb(performance.now()),350);});
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});await fitDrawnWheels(page);
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing',{timeout:6500});
});

test('PWA cold start, imported model and first complex drawing work offline',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','Playwright service-worker lifecycle is supported in Chromium.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});await expect(page.locator('#offline-status')).toContainText('OFFLINE BEREIT');
  await denseStroke(page);await page.locator('#mount-rear').click();
  await expect.poll(async()=>(await snapshot(page)).player.shapes[0].length,{timeout:30000}).toBeGreaterThan(128);
  const assets=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name));expect(assets.some(n=>n.endsWith('/offroad.glb'))).toBe(true);
  await context.setOffline(false);expect(errors).toEqual([]);
});
