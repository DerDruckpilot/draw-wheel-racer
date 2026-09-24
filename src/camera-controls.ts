/** One finger on the exposed world rotates the view. Pedals, drafting pads and
 * sliders keep their own pointer captures, including while another finger pans. */
export class CameraControls {
  private pointer?:number;
  private x=0;private y=0;
  constructor(private surface:HTMLElement,private enabled:()=>boolean,private orbit:(dx:number,dy:number)=>void){
    surface.addEventListener('pointerdown',e=>{
      if(!enabled()||this.pointer!==undefined||e.button!==0)return;
      if((e.target as Element).closest('button,input,a,canvas[id^="drawing"],.tune-panel,.home-content'))return;
      e.preventDefault();this.pointer=e.pointerId;this.x=e.clientX;this.y=e.clientY;
      surface.setPointerCapture(e.pointerId);
    });
    surface.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.pointer)return;
      if(!enabled()){this.cancel();return;}
      e.preventDefault();
      orbit((e.clientX-this.x)/Math.max(1,surface.clientWidth),(e.clientY-this.y)/Math.max(1,surface.clientHeight));
      this.x=e.clientX;this.y=e.clientY;
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(name,e=>{
      if((e as PointerEvent).pointerId===this.pointer)this.cancel();
    });
    window.addEventListener('blur',()=>this.cancel());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();});
  }
  cancel(){
    const id=this.pointer;this.pointer=undefined;
    if(id!==undefined&&this.surface.hasPointerCapture(id))this.surface.releasePointerCapture(id);
  }
}

/** Safari may start native text selection on HUD text behind an overflowing
 * pedal even though the button itself has user-select:none. Protect the whole
 * play surface, without cancelling native range input or dialog scrolling. */
export function protectPlaySurface(surface:HTMLElement){
  for(const event of ['selectstart','contextmenu','dblclick'])surface.addEventListener(event,e=>e.preventDefault());
  surface.addEventListener('pointerdown',()=>{
    const selection=window.getSelection();
    if(selection?.anchorNode&&surface.contains(selection.anchorNode))selection.removeAllRanges();
  },{passive:true});
}
