import {test,expect} from '@playwright/test';
import {drawStroke,fitDrawnWheels,snapshot} from './helpers';

test('landscape cockpit fits both pads between the pedals and frames the vehicle',async({page,browserName})=>{
  test.skip(browserName!=='webkit','Layout and WebGL framing coverage in WebKit.');
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
  for(const [width,height] of [[956,440],[844,390],[667,375]]){
    await page.setViewportSize({width,height});
    await expect.poll(()=>page.evaluate(()=>document.querySelector('.game')!.getBoundingClientRect().width)).toBe(width);
    const l=await page.evaluate(()=>{
      const r=(q:string)=>document.querySelector(q)!.getBoundingClientRect().toJSON();
      const ink=[...document.querySelectorAll<HTMLCanvasElement>('.drawing-field canvas')].flatMap(c=>{const b=c.getBoundingClientRect();return [[.2,.2],[.8,.2],[.2,.8],[.8,.8]].map(([x,y])=>document.elementFromPoint(b.x+b.width*x,b.y+b.height*y)===c)});
      return {ink,left:r('[data-pedal="brake"]'),right:r('[data-pedal="gas"]'),rear:r('#drawing-rear'),front:r('#drawing-front'),scene:r('#scene'),scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.cockpit button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b};})};
    });
    expect(l.ink.every(Boolean)).toBe(true);expect(l.scene.width).toBe(width);expect(l.scene.height).toBe(height);expect(l.scroll).toBeLessThanOrEqual(width);
    expect(l.left.right).toBeLessThan(l.rear.x);expect(l.rear.right).toBeLessThan(l.front.x);expect(l.front.right).toBeLessThan(l.right.x);
    expect(l.rear.height).toBeGreaterThanOrEqual(110);expect(l.front.width).toBeGreaterThanOrEqual(110);expect(Math.abs(l.front.width-l.front.height)).toBeLessThan(1);expect(Math.abs(l.rear.width-l.rear.height)).toBeLessThan(1);
    // Disabled pedals on the home screen intentionally ignore hit testing.
    for(const b of l.buttons){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(width);expect(b.bottom).toBeLessThanOrEqual(height);}
    for(const id of [3,4,2]){
      await page.evaluate(id=>{const a=(window as any).__FORMDRIVE__;a.load(id);a.obstacle('tunnel',300,'compact');},id);
      const frame=await page.evaluate(()=>(window as any).__FORMDRIVE__.framing());
      expect(frame.left).toBeGreaterThan(.05);expect(frame.right).toBeLessThan(.9);expect(frame.top).toBeGreaterThan(.08);expect(frame.bottom).toBeLessThan(.66);
    }
  }
  await page.setViewportSize({width:440,height:956});await expect(page.locator('.orientation-note')).toBeVisible();
  const manifest=await page.request.get('manifest.webmanifest');expect((await manifest.json()).orientation).toBe('landscape');
});

test('gas swipe latches cruise, left pedal brakes then reverses, and drawing stays independent',async({page,browserName})=>{
  test.skip(browserName!=='webkit','Pointer lifecycle coverage in WebKit.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('formdrive.v1'))localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco',best:{0:{time:12,stars:3}},favorite:[{x:-1,y:0},{x:1,y:0}]}));});
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});await fitDrawnWheels(page);
  await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  const gas=(await page.locator('[data-pedal="gas"]').boundingBox())!;
  const swipe=async()=>{await page.mouse.move(gas.x+gas.width/2,gas.y+gas.height*.7);await page.mouse.down();await page.mouse.move(gas.x+gas.width/2,gas.y+gas.height*.7-55,{steps:3});await page.mouse.up();};
  await swipe();expect((await snapshot(page)).controls.cruise).toBe(true);expect((await snapshot(page)).controls.drive).toBe(.65);
  await page.locator('[data-pedal="gas"]').click();expect((await snapshot(page)).controls.drive).toBe(0);
  await swipe();const brake=(await page.locator('[data-pedal="brake"]').boundingBox())!;
  await page.mouse.move(brake.x+brake.width/2,brake.y+brake.height/2);await page.mouse.down();
  expect((await snapshot(page)).controls).toEqual({drive:0,brake:1,cruise:false});
  await expect.poll(async()=>(await snapshot(page)).controls.drive).toBeLessThan(0);
  await page.mouse.up();expect((await snapshot(page)).controls.drive).toBe(0);
  await page.mouse.move(gas.x+30,gas.y+60);await page.mouse.down();await page.locator('[data-pedal="gas"]').dispatchEvent('pointercancel',{pointerId:1});
  expect((await snapshot(page)).controls.drive).toBe(0);await page.mouse.up();
  await page.keyboard.down('ArrowRight');const before=(await snapshot(page)).player.axleRevisions;
  await drawStroke(page,'rear',[[-.8,-.8],[.8,.8]]);expect((await snapshot(page)).player.axleRevisions).toEqual(before);
  await page.locator('#mount-rear').click();await expect.poll(async()=>(await snapshot(page)).player.axleRevisions[0]).toBeGreaterThan(before[0]);
  expect((await snapshot(page)).player.axleRevisions[1]).toBe(before[1]);expect((await snapshot(page)).controls.drive).toBe(.8);await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');expect((await snapshot(page)).controls.brake).toBe(1);await page.keyboard.up('Space');
  await swipe();await page.locator('#pause-button').click();expect((await snapshot(page)).controls).toEqual({drive:0,brake:0,cruise:false});await page.locator('#resume-game').click();
  await page.locator('#rescue-button').click();await page.evaluate(()=>(window as any).__FORMDRIVE__.finish());
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('formdrive.v1')!));expect(saved.best[0]).toEqual({time:12,stars:3});expect(saved.expeditions[0].completed).toBe(true);expect(saved.favorite).toEqual([{x:-1,y:0},{x:1,y:0}]);
  await page.reload();await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});await page.locator('#choose-course').click();await expect(page.locator('[data-level="0"]')).toContainText('GESCHAFFT');expect(errors).toEqual([]);
});
