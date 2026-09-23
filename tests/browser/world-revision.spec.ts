import {test,expect} from '@playwright/test';

test('sealed passages, winter world and readable goal signs survive repeated mobile level changes',async({page,browserName})=>{
 test.skip(browserName!=='webkit','Mobile rendering coverage in WebKit.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('formdrive.v1',JSON.stringify({quality:'high',expeditions:{0:{completed:true,noRescue:true,allCaches:true,fewestRescues:0}}})));
 await page.goto('?test=1');await expect(page.locator('#start-button')).toHaveText(/Motor starten/,{timeout:60000});
 const types=new Set<string>();
 for(const id of [0,3,4,7,13,14,15]){
  const c=await page.evaluate(id=>{const a=(window as any).__FORMDRIVE__;a.load(id);return a.course();},id);
  expect(c.caches).toEqual([]);
  for(const roof of c.obstacles.filter((o:any)=>o.structure)){
   types.add(roof.structure);
   await page.evaluate(x=>(window as any).__FORMDRIVE__.inspect(x),roof.x-5);
   const scenery=await page.evaluate(()=>(window as any).__FORMDRIVE__.scenery());
   for(const r of scenery.roofs){expect(r.transparent).toBe(false);expect(r.faces).toBeGreaterThan(1000);}
   await page.screenshot({path:`.local/v18-${id}-${roof.structure}-entry.png`});
  }
  await page.evaluate(x=>(window as any).__FORMDRIVE__.inspect(x),c.length-7);
  const scenery=await page.evaluate(()=>(window as any).__FORMDRIVE__.scenery());
  expect(scenery.goal.map((p:any)=>p.rotation)).toEqual([-Math.PI/2,Math.PI/2]);expect(scenery.goal.every((p:any)=>p.side===0)).toBe(true);
  await page.screenshot({path:`.local/v18-${id}-goal.png`});
 }
 expect([...types].sort()).toEqual(['arch','bridge','cave']);
 await page.evaluate(()=>{const a=(window as any).__FORMDRIVE__;a.load(4);const c=a.course();a.inspect(c.zones[1].start+8,'grip');});
 await page.screenshot({path:'.local/v18-winter-ice.png'});
 await page.evaluate(()=>(window as any).__FORMDRIVE__.finish());
 await expect(page.locator('.mission-results li')).toHaveCount(2);await expect(page.locator('#modal')).not.toContainText('Fundstück');
 await page.locator('#finish-home').click();await expect(page.locator('[data-level="0"] .level-record b')).toHaveText('★★');
 expect(errors).toEqual([]);
});
