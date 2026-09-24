import {test,expect} from '@playwright/test';
import {fitDrawnWheels,snapshot} from './helpers';

test('vertical axle sliders stay outside the glass and gyro permission, calibration and pause work',async({page,browserName})=>{
  test.skip(browserName!=='webkit');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco',expeditionTutorial:true}));
    Object.defineProperty(DeviceOrientationEvent,'requestPermission',{value:async()=>{(window as any).__sensorRequests=((window as any).__sensorRequests??0)+1;return 'granted';}});
    Object.defineProperty(Object.getPrototypeOf(screen.orientation),'angle',{get:()=>90,configurable:true});
  });
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});
  for(const [width,height] of [[956,440],[667,375]]){
    await page.setViewportSize({width,height});
    const bounds=await page.evaluate(()=>['#stiffness-rear','#drawing-rear','#drawing-front','#stiffness-front'].map(q=>document.querySelector(q)!.getBoundingClientRect().toJSON()));
    expect(bounds[0].right).toBeLessThan(bounds[1].left);expect(bounds[2].right).toBeLessThan(bounds[3].left);
    expect(bounds[0].height).toBeGreaterThan(bounds[0].width*2);expect(bounds[3].right).toBeLessThan(width-70);
  }
  await page.setViewportSize({width:956,height:440});
  const slider=(await page.locator('#stiffness-rear').boundingBox())!;
  await page.mouse.move(slider.x+slider.width/2,slider.y+10);await page.mouse.down();await page.mouse.move(slider.x+slider.width/2,slider.y+slider.height-8,{steps:8});await page.mouse.up();
  expect((await snapshot(page)).stiffness[0]).toBeLessThan(.15);expect((await snapshot(page)).stiffness[1]).toBe(1);
  await page.locator('#stiffness-rear').focus();await page.locator('#stiffness-rear').press('End');
  await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');
  await page.locator('#tune-button').click();await page.locator('#gyro-enable').click();expect(await page.evaluate(()=>(window as any).__sensorRequests)).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(Object.assign(new Event('deviceorientation'),{beta:0,gamma:0})));
  await expect(page.locator('#gyro-status')).toHaveText('Aktiv');await page.locator('#close-tune').click();
  await page.evaluate(()=>{(window as any).__motion=setInterval(()=>window.dispatchEvent(Object.assign(new Event('deviceorientation'),{beta:24,gamma:-18})),40);});
  await expect.poll(async()=>(await snapshot(page)).tuning.weightTarget).toBeGreaterThan(.9);
  await expect.poll(async()=>(await snapshot(page)).tuning.steering).toBeLessThan(-.5);
  await page.locator('#tune-button').click();await page.locator('#gyro-calibrate').click();
  expect((await snapshot(page)).tuning.gyro.weight).toBe(0);await page.locator('#close-tune').click();
  await page.locator('#pause-button').click();expect((await snapshot(page)).tuning.gyro.weight).toBe(0);expect((await snapshot(page)).tuning.steering).toBe(0);await page.locator('#resume-game').click();
  await page.evaluate(()=>{clearInterval((window as any).__motion);window.dispatchEvent(Object.assign(new Event('deviceorientation'),{beta:0,gamma:0}));});await expect.poll(async()=>(await snapshot(page)).tuning.weightTarget).toBeLessThan(-.25);await expect.poll(async()=>(await snapshot(page)).tuning.weightTarget).toBe(0);
  await expect(page.locator('#gyro-status')).toHaveText('Keine Sensordaten');
  await page.evaluate(()=>window.dispatchEvent(Object.assign(new Event('deviceorientation'),{beta:-15,gamma:8})));
  await expect(page.locator('#gyro-status')).toHaveText('Aktiv');expect((await snapshot(page)).tuning.gyro.weight).toBe(0);
  await page.screenshot({path:'test-results/mobile-sliders.png'});expect(errors).toEqual([]);
});

test('denied sensor permission leaves the touch cockpit and manual steering usable',async({page,browserName})=>{
  test.skip(browserName!=='webkit');
  await page.addInitScript(()=>{localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'}));Object.defineProperty(DeviceOrientationEvent,'requestPermission',{value:async()=>'denied'});});
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:120000});await page.locator('#tune-button').click();await page.locator('#gyro-enable').click();
  await expect(page.locator('#gyro-status')).toHaveText('Sensorzugriff nicht erlaubt');expect((await snapshot(page)).tuning.gyro.active).toBe(false);
  await page.locator('#close-tune').click();await fitDrawnWheels(page);await page.locator('#start-button').click();await expect(page.locator('.game')).toHaveAttribute('data-state','racing');await page.locator('#tune-button').click();await page.locator('#steering').focus();await page.locator('#steering').press('End');await expect.poll(async()=>(await snapshot(page)).tuning.steering).toBe(-1);await page.locator('#close-tune').click();expect((await snapshot(page)).tuning.steering).toBe(0);
  await expect(page.locator('#drawing-rear')).toBeVisible();
});
