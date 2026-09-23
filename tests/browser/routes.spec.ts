import {test,expect} from '@playwright/test';
import {snapshot} from './helpers';

test('wide route selection and physical surf render with the mobile drawing cockpit',async({page,browserName})=>{
  test.skip(browserName!=='webkit');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'high',sound:false,expeditionTutorial:true})));
  await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
  const route=await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__,c=a.course();a.inspect(c.routes.forks[0].decision,'round');a.drive(.45);a.steer(1);a.step(600);return {halfWidth:c.routes.halfWidth,paths:c.routes.forks[0].paths};});
  expect(route.halfWidth).toBeGreaterThan(9);expect(route.paths).toHaveLength(3);expect((await snapshot(page)).tuning.lateral.offset).toBeGreaterThan(6);
  const frame=await page.evaluate(()=>(window as any).__FORMDRIVE__.framing());expect(frame.top).toBeGreaterThan(.08);expect(frame.bottom).toBeLessThan(.66);
  await page.screenshot({path:'.local/v111-choose-route.png'});
  const motion=await page.evaluate(()=>{
    const a=(window as any).__FORMDRIVE__;a.load(17);const w=a.course().waters.find((w:any)=>w.waves);a.inspect(w.start+13,'paddle',w.lateral);a.drive(.4);let low=Infinity,high=-Infinity;
    for(let i=0;i<18;i++){a.step(20);const p=a.snapshot().player;low=Math.min(low,p.pitch);high=Math.max(high,p.pitch);}
    return {low,high,fallCount:a.course().waters.filter((w:any)=>w.fall).length};
  });
  expect(motion.fallCount).toBe(0);expect(motion.high-motion.low).toBeGreaterThan(.25);expect((await snapshot(page)).player.resets).toBe(0);
  await page.screenshot({path:'.local/v111-physical-surf.png'});
  for(const field of ['#drawing-rear','#drawing-front'])await expect(page.locator(field)).toBeVisible();
  expect(errors).toEqual([]);
});
