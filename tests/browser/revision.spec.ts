import {test,expect} from '@playwright/test';
import {denseStroke,snapshot} from './helpers';

test('long draft prepares only on mount and a cancelled worker never replaces either axle',async({page,browserName})=>{
  test.skip(browserName!=='webkit','Worker and drawing lifecycle in WebKit.');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'eco'})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
  await denseStroke(page);expect((await snapshot(page)).player.shapes).toEqual([[],[]]);
  await page.locator('#mount-rear').click();await expect.poll(async()=>(await snapshot(page)).player.shape,{timeout:20000}).toBeGreaterThan(128);
  const installed=(await snapshot(page)).player.shapes;
  await denseStroke(page,'front');
  const pending=await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#mount-front')!.click();const busy=document.querySelector('#drawing-front')!.getAttribute('aria-busy');document.querySelector<HTMLButtonElement>('#clear-front')!.click();return busy;});
  expect(pending).toBe('true');await expect(page.locator('#drawing-front')).not.toHaveAttribute('aria-busy','true');
  await page.waitForTimeout(800);expect((await snapshot(page)).player.shapes).toEqual(installed);expect(errors).toEqual([]);
});
