import {test,expect} from '@playwright/test';
import {fitDrawnWheels,drawStroke,snapshot} from './helpers';

test('swiping the world orbits freely, while drafting and sizing keep their own pointers',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('formdrive.world.v2',JSON.stringify({schema:2,level:0,records:{},runs:{},sound:false,quality:'eco',tutorial:true})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});
  await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  const before=await snapshot(page);
  await page.mouse.move(310,185);await page.mouse.down();await page.mouse.move(650,220,{steps:6});await page.mouse.up();
  const orbit=(await snapshot(page)).framing.orbit;
  expect(Math.abs(orbit.yaw)).toBeGreaterThan(2);expect(orbit.pitch).toBeGreaterThan(before.framing.orbit.pitch);
  expect((await snapshot(page)).drafts).toEqual([[],[]]);
  await drawStroke(page,'rear',[[-.8,0],[.8,0]]);
  const draft=(await snapshot(page)).drafts[0];expect(draft.length).toBeGreaterThan(1);
  expect((await snapshot(page)).framing.orbit).toEqual(orbit);
  const sizes=(await snapshot(page)).wheelSizes;
  await page.locator('#wheel-size-rear').focus();await page.locator('#wheel-size-rear').press('Home');
  await expect.poll(async()=>(await snapshot(page)).wheelSizes[0]).toBeCloseTo(.4,3);
  expect((await snapshot(page)).wheelSizes[1]).toBe(sizes[1]);
  expect((await snapshot(page)).drafts[0]).toEqual(draft);expect((await snapshot(page)).shapes).toEqual(before.shapes);
  await page.locator('#wheel-size-front').focus();await page.locator('#wheel-size-front').press('End');
  await expect.poll(async()=>(await snapshot(page)).wheelSizes[1]).toBeCloseTo(1.4,3);
  expect((await snapshot(page)).framing.orbit).toEqual(orbit);
  await page.locator('#pause-button').click();await page.locator('#resume-game').click();
  expect((await snapshot(page)).framing.orbit).toEqual(orbit);
  expect(errors).toEqual([]);
});

test('rapid pedal taps cannot select HUD text or open a DOM context menu',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});
  await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  const gas=page.locator('[data-pedal="gas"]'),r=(await gas.boundingBox())!;
  for(let i=0;i<4;i++)await page.touchscreen.tap(r.x+r.width*.52,r.y+r.height*.4);
  await gas.dblclick();
  const protectedSurface=await page.evaluate(()=>{
    const nodes=['.game','.pedal-face','#race-name','#checkpoint-label','.wheel-slider span'];
    const selection=nodes.map(q=>getComputedStyle(document.querySelector(q)!).getPropertyValue('-webkit-user-select')||getComputedStyle(document.querySelector(q)!).userSelect);
    const target=document.querySelector('#race-name')!;
    return {selection,text:window.getSelection()?.toString(),context:target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),select:target.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})),touch:getComputedStyle(document.querySelector('#scene')!).touchAction,panelTouch:getComputedStyle(document.querySelector('.tune-panel')!).touchAction};
  });
  expect(protectedSurface.selection.every(value=>value==='none')).toBe(true);expect(protectedSurface.text).toBe('');expect(protectedSurface.context).toBe(false);expect(protectedSurface.select).toBe(false);expect(protectedSurface.touch).toBe('none');expect(protectedSurface.panelTouch).toBe('pan-y');
  expect((await snapshot(page)).controls.drive).toBe(0);expect((await snapshot(page)).controls.cruise).toBe(false);
});

test('a second touch rotates the camera while the gas pedal stays held',async({page,browserName,context})=>{
  test.skip(browserName!=='chromium','Native multi-touch injection uses the Chromium input protocol.');
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});
  await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  const client=await context.newCDPSession(page),r=(await page.locator('[data-pedal="gas"]').boundingBox())!,gas={id:1,x:r.x+r.width/2,y:r.y+r.height*.55};
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas]});
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas,{id:2,x:320,y:180}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[gas,{id:2,x:580,y:205}]});
  expect((await snapshot(page)).controls.drive).toBeGreaterThan(.3);expect(Math.abs((await snapshot(page)).framing.orbit.yaw)).toBeGreaterThan(1);
  // Removing a point in a move releases just that finger; touchEnd ends the
  // complete gesture and must have an empty touchPoints array in CDP.
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[gas]});
  expect((await snapshot(page)).controls.drive).toBeGreaterThan(.3);
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect((await snapshot(page)).controls.drive).toBe(0);expect((await snapshot(page)).drafts).toEqual([[],[]]);
  await client.detach();
});
