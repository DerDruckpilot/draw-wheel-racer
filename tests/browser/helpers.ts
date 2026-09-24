import type { Page } from '@playwright/test';
export async function drawStroke(page: Page, axle: 'rear' | 'front', points: [number,number][]) {
  const r = (await page.locator(`#drawing-${axle}`).boundingBox())!, scale=Math.min(r.width,r.height)*.43/1.2;
  await page.mouse.move(r.x+r.width/2+points[0][0]*scale,r.y+r.height/2-points[0][1]*scale);await page.mouse.down();
  // Deliver a coalesced burst between genuine pointer down/up events. Waiting
  // for a remote round-trip per sample distorts input on software WebGL.
  await page.evaluate(({axle,points})=>{
    const canvas=document.querySelector<HTMLCanvasElement>(`#drawing-${axle}`)!,r=canvas.getBoundingClientRect(),scale=Math.min(r.width,r.height)*.43/1.2;
    for(const p of points.slice(1))canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'mouse',button:0,buttons:1,clientX:r.x+r.width/2+p[0]*scale,clientY:r.y+r.height/2-p[1]*scale,bubbles:true}));
  },{axle,points});
  const last=points.at(-1)!;await page.mouse.move(r.x+r.width/2+last[0]*scale,r.y+r.height/2-last[1]*scale);
  await page.mouse.up();
}
export async function fitDrawnWheels(page: Page) {
  const ring: [number,number][] = Array.from({length:33},(_,i)=>[Math.cos(i/32*Math.PI*2)*.82,Math.sin(i/32*Math.PI*2)*.82]);
  for(const axle of ['rear','front'] as const){await drawStroke(page,axle,ring);await page.locator(`#mount-${axle}`).click();}
}
export const snapshot = (page: Page) => page.evaluate(()=>(window as any).__FORMDRIVE__.snapshot());
export async function denseStroke(page: Page, axle='rear') {
  const r=(await page.locator(`#drawing-${axle}`).boundingBox())!;
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.evaluate(axle=>{
    const canvas=document.querySelector<HTMLCanvasElement>(`#drawing-${axle}`)!,r=canvas.getBoundingClientRect(),scale=Math.min(r.width,r.height)*.43/1.2;
    for(let i=0;i<=1440;i++){const a=i/160*Math.PI*2,rad=.2+.9*i/1440;canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'mouse',button:0,buttons:1,clientX:r.x+r.width/2+Math.cos(a)*rad*scale,clientY:r.y+r.height/2-Math.sin(a)*rad*scale,bubbles:true}));}
  },axle);
  await page.mouse.up();
}
