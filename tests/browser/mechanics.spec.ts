import {test,expect} from '@playwright/test';
import {fitDrawnWheels,snapshot} from './helpers';

test('mechanical adventures render in mobile WebKit, expose live tuning, and preserve the drawing cockpit',async({page,browserName})=>{
  test.skip(browserName!=='webkit');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'high',sound:false,expeditionTutorial:true})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});await fitDrawnWheels(page);
  await expect(page.locator('#tune-panel')).toBeHidden();await page.locator('#tune-button').click();
  await page.locator('#stiffness-rear').focus();await page.locator('#stiffness-rear').press('Home');
  await expect.poll(async()=> (await snapshot(page)).tuning.flex[0].stiffness).toBe(0);
  expect((await snapshot(page)).tuning.flex[1].stiffness).toBe(1);
  await page.locator('#ballast').focus();await page.locator('#ballast').press('End');expect((await snapshot(page)).tuning.ballastTarget).toBe(1);
  await page.locator('#ballast').press('ArrowLeft');expect((await snapshot(page)).controls.drive).toBe(0);
  await page.screenshot({path:'.local/v19-tuning.png'});await page.locator('#close-tune').click();
  await page.locator('#choose-course').click();await expect(page.locator('[data-level]')).toHaveCount(22);await expect(page.locator('[data-level="20"]')).toContainText('Versorgungsfahrt');await page.locator('#close-modal').click();
  // Apply vehicle load to the actual control apron, then simulate filling.
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(16);const plate=a.course().mechanisms.find((m:any)=>m.kind==='plate');a.inspect(plate.x,'round',plate.lateral+.95);a.drive(0,1);a.step(1440);});
  const lock=await snapshot(page);expect(lock.mechanics.signals.length).toBeGreaterThan(0);expect(lock.mechanics.waterLevels[0]).toBeGreaterThan(-.1);
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;const w=a.course().waters[0];a.inspect(w.start+13,'paddle',w.lateral);});
  await page.screenshot({path:'.local/v19-lock.png'});
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(17);const w=a.course().waters.find((w:any)=>w.waves);a.inspect(w.start+13,'paddle',w.lateral);a.drive(.5);a.step(240);});
  await page.screenshot({path:'.local/v19-river.png'});expect((await snapshot(page)).player.resets).toBe(0);
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(18);const m=a.course().mechanisms.find((m:any)=>m.kind==='breakice');a.inspect(m.x,'round',m.lateral);a.drive(0,1);a.step(240);});
  expect((await snapshot(page)).mechanics.machines.some((m:any)=>m.damage>0)).toBe(true);await page.screenshot({path:'.local/v19-thin-ice.png'});
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(19);const r=a.course().masterRoutes[0];a.inspect(r.marks[0].x-7,'grip',r.lateral);});
  await page.screenshot({path:'.local/v19-master-route.png'});
  await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(20);a.inspect(7,'round');});
  expect((await snapshot(page)).mechanics.freight).toBe(100);await page.screenshot({path:'.local/v19-freight.png'});
  expect(errors).toEqual([]);
});
