import './style.css';
import {registerSW} from 'virtual:pwa-register';
import {createWorldLevel,WORLD_LEVELS,WORLD_COUNT,worldHeight} from './world-levels';
import {WorldSimulation,initWorldPhysics,WORLD_DT} from './world-physics';
import {WorldRenderer} from './world-renderer';
import {restoreWorldSave,completedRecord,captureWorldRun,restoreWorldRun,WORLD_SAVE_KEY,type WorldSave} from './world-save';
import {DriveControls} from './drive-controls';
import {TiltControls} from './tilt-controls';
import {CameraControls,protectPlaySurface} from './camera-controls';
import {MIN_WHEEL_SIZE,MAX_WHEEL_SIZE,wheelSizeLabel} from './wheel-size';
import {DrawingPad} from './drawing';
import {GameAudio} from './audio';
import {clamp,preset,type Point,type ShapeName} from './shapes';
const {save:saved,migrated}=restoreWorldSave({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)});
let storageWarning=false;
function persist(){try{localStorage.setItem(WORLD_SAVE_KEY,JSON.stringify(saved));storageWarning=false;}catch{if(!storageWarning){storageWarning=true;toast('Spielstand kann gerade nicht gespeichert werden.');}}}
const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10a6 6 0 0 1 0 12"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  sound: '<path d="M4 9h4l5-5v16l-5-5H4zM17 8a6 6 0 0 1 0 8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  tune:'<rect x="3" y="7" width="4" height="10" rx="2"/><rect x="17" y="7" width="4" height="10" rx="2"/><path d="M7 12h10M10 8l2-3 2 3M10 16l2 3 2-3"/>',
  valve:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6"/>',
};
const svg = (key: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
const axleSlider=(axle:string)=>`<label class="wheel-slider" aria-label="${axle==='rear'?'Hinterachse':'Vorderachse'}"><span class="wheel-size-large" aria-hidden="true">◯</span><input id="wheel-size-${axle}" type="range" min="${MIN_WHEEL_SIZE}" max="${MAX_WHEEL_SIZE}" step="0.01" value="1" aria-label="Radgröße ${axle==='rear'?'Hinterachse':'Vorderachse'}" aria-valuetext="100 %"><span class="wheel-size-small" aria-hidden="true">∘</span></label>`;
document.querySelector('#app')!.innerHTML = `
<main class="game" aria-label="FORMDRIVE Physik-Abenteuer">
  <section class="stage" id="stage">
    <div id="scene"></div><div class="scene-vignette"></div>
    <header class="topbar">
      <button class="wordmark" id="home-button" aria-label="Zur Startansicht">FORM<span>DRIVE</span><i></i></button>
      <div class="top-actions"><button class="icon-button" id="tune-button" aria-label="Fahrwerk einstellen" aria-controls="tune-panel" aria-expanded="false">${svg('tune')}</button><button class="icon-button" id="pause-button" aria-label="Spiel pausieren" hidden>${svg('pause')}</button><button class="icon-button" id="settings-button" aria-label="Einstellungen">${svg('settings')}</button></div>
    </header>
    <div class="race-hud" id="race-hud" hidden>
      <div class="race-title"><span id="race-region"></span><strong id="race-name"></strong></div>
      <div class="expedition-status"><span id="checkpoint-label">STARTLAGER</span><span id="finds">0 ◇</span></div>
    </div>
    <aside class="radar" id="radar" aria-label="Ungefähre Zielrichtung und Entfernung" hidden><div class="radar-dial"><i class="radar-sector" id="radar-sector"></i><b></b></div><span id="radar-distance">–</span></aside>
    <div class="home-content" id="home-content">
      <div class="home-heading"><p class="eyebrow"><i></i> DEINE EXPEDITION</p><h1>FORM<br><em>DRIVE.</em></h1><p class="home-tagline">Schaffst du den Weg?<br>Fahre. Zeichne. Klettere.</p></div>
      <div class="home-bottom"><button class="course-preview" id="choose-course"><span class="course-number" id="course-number">01</span><span><small id="course-region">CANYON</small><strong id="course-name">Zum Basislager</strong></span>${svg('grid')}</button><button class="primary-button" id="start-button" disabled><span>Welt wird geladen …</span><b>${svg('arrow')}</b></button><div class="home-meta"><span id="offline-status"><i></i> WIRD VORBEREITET</span><span>21 GELÄNDEGEBIETE · KEIN ZEITLIMIT</span></div></div>
    </div>
    <div class="drive-info" id="drive-info" hidden><div class="speed"><strong id="speed">0</strong><span>KM/H</span></div><div class="terrain-chip"><i></i><span id="terrain-label">FESTER BODEN</span></div><button class="rescue-button" id="rescue-button" aria-label="Zum letzten Checkpoint zurücksetzen">${svg('reset')}<span>BERGEN</span></button></div>
    <div class="countdown" id="countdown" hidden>3</div>
    <button class="icon-button interaction-button" id="interact-button" aria-label="Ventil bedienen" hidden>${svg('valve')}</button>
    <div class="loading-bar" id="loading-bar"><span></span></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <section class="tune-panel" id="tune-panel" aria-label="Fahrwerk" hidden>
      <div class="tune-heading"><strong>Neigungssteuerung</strong><button id="close-tune" aria-label="Fahrwerk schließen">${svg('close')}</button></div>
<p class="tilt-copy">Links / rechts kippen: lenken.<br>Vor / zurück kippen: Gewicht verlagern.<br>Über die Welt streichen: Kamera drehen.</p><button class="sensor-button" id="gyro-enable">Neigung aktivieren</button><div class="sensor-actions"><button id="gyro-calibrate" disabled>Neutralstellung</button><button id="gyro-disable" disabled>Aus</button></div><p id="gyro-status" role="status">Aus · auch mit Touch spielbar</p>
      <label for="ballast">Gewicht <output id="ballast-value">Mitte</output></label><input id="ballast" type="range" min="-1" max="1" step="0.1" value="0" aria-label="Gewicht nach hinten oder vorne verlagern">
<div class="tune-ends"><span>← Hinten</span><span>Vorne →</span></div><label for="steering">Lenken ohne Sensoren</label><input id="steering" type="range" min="-1" max="1" step="0.05" value="0" aria-label="Seitlich lenken"><div class="tune-ends"><span>Links</span><span>Rechts</span></div>
    </section>
  </section>
  <section class="cockpit" id="drive-controls" aria-label="Fahren und Räder zeichnen">
    <button class="pedal brake-pedal" data-pedal="brake" aria-label="Bremse und Rückwärtsgang" aria-pressed="false"><i class="pedal-arm"></i><span class="pedal-face"><i></i><i></i><i></i><i></i></span></button>
    <div class="axle-pads">${axleSlider('rear')}${['rear', 'front'].map((axle, i) => `<section class="axle-pad" aria-label="${i ? 'Vorderräder' : 'Hinterräder'} zeichnen">
      <div class="axle-toolbar"><button class="mount-button" id="mount-${axle}" aria-label="${i ? 'Vorderräder' : 'Hinterräder'} montieren" disabled>${svg('check')}</button></div>
      <div class="drawing-field"><canvas id="drawing-${axle}" aria-label="${i ? 'Vorderräder' : 'Hinterräder'} zeichnen, mehrere Striche möglich"></canvas></div>
      <div class="draft-tools"><button id="undo-${axle}" aria-label="Letzten Strich ${i ? 'vorne' : 'hinten'} entfernen">${svg('undo')}</button><button id="clear-${axle}" aria-label="Zeichenfläche ${i ? 'vorne' : 'hinten'} leeren">${svg('close')}</button></div>
    </section>`).join('')}${axleSlider('front')}</div>
    <button class="pedal gas-pedal" data-pedal="gas" aria-label="Gas, nach oben wischen aktiviert den Tempomat" aria-pressed="false"><i class="pedal-arm"></i><span class="pedal-face"><i></i><i></i><i></i><i></i><i></i></span><b class="cruise-light" aria-hidden="true">↟</b></button>
  </section>
</main>
<dialog id="modal" aria-labelledby="modal-title"><div class="modal-shell"><button class="modal-close small-icon" id="close-modal" aria-label="Dialog schließen">${svg('close')}</button><div id="modal-content"></div></div></dialog>
<div class="orientation-note" role="status"><span>↻</span><strong>Dein Weg liegt quer.</strong><p>Drehe dein iPhone ins Querformat.<br>Bei Bedarf die Ausrichtungssperre ausschalten.</p></div>`;

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const modal=$<HTMLDialogElement>('modal');
const sound=new GameAudio();sound.enabled=saved.sound;
let sim:WorldSimulation,renderer:WorldRenderer,currentLevel=saved.level;
let state:'loading'|'home'|'countdown'|'racing'|'paused'|'finished'='loading';
let resumeState:'racing'|'countdown'|null=null;
let countdown=3,countdownUpdated=0,accumulator=0,lastHud=0,lastSave=0;
let toastTimer:ReturnType<typeof setTimeout>,updateReady=false,updateRequested=false;
const formatTime=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
const region=(id:number)=>({canyon:'CANYON',forest:'WURZELWALD',coast:'KÜSTE',glacier:'GLETSCHER',quarry:'STEINBRUCH'})[WORLD_LEVELS[id][1]];
function toast(text:string){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3400);}
const pads=['rear','front'].map((name,axle)=>{
  let pad:DrawingPad;
  const refresh=()=>{if(!pad)return;const button=$<HTMLButtonElement>('mount-'+name);button.disabled=!pad.enabled||!pad.dirty||pad.busy||pad.active;button.classList.toggle('preparing',pad.busy);button.setAttribute('aria-busy',String(pad.busy));};
  pad=new DrawingPad($<HTMLCanvasElement>('drawing-'+name),shape=>!sim||sim.requestShape(shape,axle),toast,refresh);
  $('mount-'+name).onclick=()=>{if(!modal.open)void pad.mount();};$('undo-'+name).onclick=()=>{if(pad.enabled)pad.undo();};$('clear-'+name).onclick=()=>{if(pad.enabled)pad.clear();};return pad;
});
const controls=new DriveControls($('drive-controls'),(drive,brake)=>{if(sim){sim.drive=drive;sim.brake=brake;}},()=>sim?.signedSpeed??0);
protectPlaySurface(document.querySelector<HTMLElement>('.game')!);
const cameraControls=new CameraControls($('stage'),()=>!!renderer&&state!=='loading'&&!modal.open&&!!$('tune-panel').hidden,(dx,dy)=>renderer.orbitBy(dx,dy));
function toggleTune(open:boolean){$('tune-panel').hidden=!open;$('tune-button').setAttribute('aria-expanded',String(open));}
$('tune-button').onclick=()=>{if(sim)toggleTune(!!$('tune-panel').hidden);};$('close-tune').onclick=()=>toggleTune(false);
for(const [axle,name] of ['rear','front'].entries()){
  const input=$<HTMLInputElement>('wheel-size-'+name);input.oninput=()=>{sim?.setWheelSize(axle,+input.value);input.setAttribute('aria-valuetext',wheelSizeLabel(+input.value));};input.addEventListener('keydown',e=>e.stopPropagation());
}
$('ballast').oninput=()=>{$('ballast-value').textContent=+$<HTMLInputElement>('ballast').value<-.1?'Hinten':+$<HTMLInputElement>('ballast').value>.1?'Vorne':'Mitte';};
$('tune-panel').addEventListener('keydown',e=>e.stopPropagation());
const tilt=new TiltControls(()=>{$('gyro-status').textContent=tilt.status;$<HTMLButtonElement>('gyro-calibrate').disabled=!tilt.active;$<HTMLButtonElement>('gyro-disable').disabled=!tilt.active;$('tune-button').classList.toggle('sensor-active',tilt.active);});
$('gyro-enable').onclick=()=>{void tilt.enable();};$('gyro-calibrate').onclick=()=>tilt.calibrate();$('gyro-disable').onclick=()=>tilt.disable();
for(const event of ['pointerup','pointercancel','blur'])$('steering').addEventListener(event,()=>{$<HTMLInputElement>('steering').value='0';if(sim)sim.steering=0;});
function setState(next:typeof state){
  cameraControls.cancel();
  state=next;if(next==='countdown')countdownUpdated=performance.now();
  const home=state==='home'||state==='loading';$('home-content').hidden=!home;$('race-hud').hidden=home;$('radar').hidden=home;$('drive-info').hidden=home;$('pause-button').hidden=home||state==='finished';$('countdown').hidden=state!=='countdown';
  $('drive-controls').classList.toggle('not-driving',home||state==='finished');controls.enabled=state==='racing';
  if(!controls.enabled){controls.reset();tilt.suspend();if(sim)sim.steering=0;}else tilt.resume();
  for(const pad of pads){pad.enabled=state!=='loading'&&state!=='finished';if(!pad.enabled)pad.cancel();else pad.render();}
  if(sim)sim.started=state==='racing';if(next==='paused'||next==='finished')toggleTune(false);
  document.querySelector('.game')!.setAttribute('data-state',state);
}
function saveRun(){if(sim&&sim.elapsed>.2&&!sim.finished&&state!=='home'&&state!=='loading'){saved.runs[currentLevel]=captureWorldRun(sim);persist();}}
function loadLevel(id:number,home=true,discardRun=false){
  if(!discardRun)saveRun();else delete saved.runs[id];
  pads.forEach(p=>p.cancel());sim?.dispose();currentLevel=id;saved.level=id;
  const run=saved.runs[id];
  sim=new WorldSimulation(createWorldLevel(id),renderer.collisions,run?.shapes??pads.map(p=>p.shape.length?p.shape:preset('round')));
  const resumed=!!run&&restoreWorldRun(sim,run);
  if(resumed)for(const [i,pad] of pads.entries()){pad.shape=sim.shapes[i];pad.draft=[];pad.render();const input=$<HTMLInputElement>('wheel-size-'+['rear','front'][i]);input.value=String(sim.wheelSizeTargets[i]);input.setAttribute('aria-valuetext',wheelSizeLabel(sim.wheelSizeTargets[i]));}
  else for(const [i,name] of ['rear','front'].entries())sim.setWheelSize(i,+$<HTMLInputElement>('wheel-size-'+name).value);
  renderer.setWorld(sim);
  toggleTune(false);document.querySelector<HTMLElement>('.game')!.dataset.theme=sim.level.biome==='glacier'?'alpine':sim.level.biome;
  accumulator=0;clearTimeout(toastTimer);$('toast').classList.remove('visible');$('course-number').textContent=String(id+1).padStart(2,'0');$('course-region').textContent=region(id)+' · FREIES GELÄNDE';$('course-name').textContent=sim.level.name;$('race-region').textContent=region(id)+' / '+String(id+1).padStart(2,'0');$('race-name').textContent=sim.level.name;
  persist();setState(home?'home':'countdown');renderer.render(sim,.016);updateHud();
  $('start-button').innerHTML=`<span>${resumed?'Ab Lager fortsetzen':'Motor starten'}</span><b>${svg('arrow')}</b>`;
}
function begin(){
  if(state==='loading')return;
  if(pads.some(p=>p.shape.length<2)){toast('Zeichne für beide Achsen eine Form und montiere sie mit den Häkchen.');return;}
  const orientation=screen.orientation as ScreenOrientation&{lock?:(mode:string)=>Promise<void>};orientation.lock?.('landscape').catch(()=>{});sound.unlock().catch(()=>{});
  countdown=3;accumulator=0;$('countdown').textContent='3';setState('countdown');
  if(!saved.tutorial){saved.tutorial=true;persist();toast('Freies Gelände · das Radar zeigt nur die grobe Richtung.');}
}
function openModal(content:string,resume=true){if(state==='racing'||state==='countdown'){resumeState=resume?state:null;setState('paused');}$('modal-content').innerHTML=content;if(!modal.open)modal.showModal();}
function closeModal(){modal.close();if(resumeState){const next=resumeState;resumeState=null;accumulator=0;setState(next);}else if(state==='finished')loadLevel(currentLevel);}
modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});$('close-modal').onclick=closeModal;
function showPause(){
  if(state!=='racing'&&state!=='countdown')return;
  saveRun();
  openModal(`<p class="eyebrow dark">KURZE AUSZEIT</p><h2 id="modal-title">Durchatmen.</h2><p class="modal-copy">${sim.level.name} · ${formatTime(sim.elapsed)}</p><button class="primary-button full" id="resume-game">Weiterfahren ${svg('arrow')}</button><div class="button-pair"><button class="secondary-button" id="restart-game">Neu starten</button><button class="secondary-button" id="back-home">Gebiete</button></div><button class="secondary-button full" id="reset-props">Bewegliche Gegenstände in der Nähe zurücksetzen</button>`);
  $('resume-game').onclick=closeModal;$('restart-game').onclick=()=>{resumeState=null;modal.close();loadLevel(currentLevel,true,true);begin();};$('back-home').onclick=()=>{resumeState=null;modal.close();loadLevel(currentLevel);showCourses();};$('reset-props').onclick=()=>{sim.resetObjects();closeModal();toast('Gegenstände in der Nähe zurückgesetzt');};
}
function showCourses(){
  openModal(`<p class="eyebrow dark">NEUE WELTEN</p><h2 id="modal-title">Finde deinen Weg.</h2><p class="modal-copy">21 offene Geländegebiete. Erkunde, verschiebe Gegenstände und versorge das Ziellager mit Energie. Checkpoints musst du finden. Ein Stern fürs Ziel, einer ohne Bergung, einer für alle drei versteckten Fundstücke.</p><div class="course-list">${WORLD_LEVELS.map(([name],id)=>`<button class="level-card ${id===currentLevel?'active':''}" data-level="${id}"><span class="level-no">${String(id+1).padStart(2,'0')}</span><span class="level-text"><strong>${name}</strong><small>${region(id)} · ${id<4?'KNifflig'.toUpperCase():id<12?'ANSPRUCHSVOLL':'EXPERTE'}</small></span><span class="level-record">${saved.records[id]?`<b>${'★'.repeat(saved.records[id].stars)}</b><small>GESCHAFFT</small>`:'○'.repeat(2+Math.floor(id/6))}</span></button>`).join('')}</div>`);
  document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b=>b.onclick=()=>{resumeState=null;modal.close();loadLevel(+b.dataset.level!);});
}
function showHelp(){
  openModal(`<p class="eyebrow dark">DEINE EXPEDITION</p><h2 id="modal-title">Erkunden. Bauen. Weiterkommen.</h2><ol class="help-list"><li><strong>Finde das Ziellager.</strong> Das Radar nennt nur einen groben Zielsektor und ein Entfernungsband. Du kannst dich frei durch die Landschaft bewegen. Es gibt keine eingezeichnete Lösung.</li><li><strong>Lenken und balancieren.</strong> Aktiviere die Neigung im Fahrwerkmenü: Rechts/links kippen lenkt, vor/zurück kippen verlagert das Gewicht. Streiche mit einem Finger über die freie Bildmitte, um die Kamera rund um das Fahrzeug zu drehen. Touchregler stehen im selben Menü bereit.</li><li><strong>Zeichne beide Achsen.</strong> Links hinten, rechts vorne. Mehrere Striche sind möglich. Das Häkchen montiert und leert den Entwurf. Die äußeren Regler ändern die montierte Radgröße: oben groß, unten klein. Beide Achsen lassen sich getrennt von 40 bis 140 Prozent skalieren. Große Räder brauchen Platz; kleine passen durch niedrige Durchgänge.</li><li><strong>Gas und Bremse.</strong> Rechts dosiert Gas geben, links bremsen und beim Stillstand weiter halten für rückwärts. Ein Wisch am Gas nach oben schaltet den Tempomat ein.</li><li><strong>Gewicht hat Wirkung.</strong> Druckplatten funktionieren nur, solange Gewicht auf ihnen liegt. Lose Felsen, Kisten und Fässer kannst du verschieben. Kabel verbinden die Platten mit ihren Mechanismen. Manche Anlagen benötigen mehrere Signale. Bei gefundenen Ventilen erscheint ein Handrad: halte an und tippe es an. Wasserstände, Hebebühnen und Wippen verändern mögliche Wege.</li><li><strong>Energie und Fundstücke.</strong> Kleine Versorgungskisten enthalten Energiezellen für die Generatoren im Gebiet. Fahre mit genügend Zellen an einen Generator heran, um ihn zu versorgen. Versorgte Generatoren leuchten und schalten das Ziellager frei. Drei zusätzliche Fundstücke pro Gebiet ergeben den dritten Stern.</li><li><strong>Lager entdecken.</strong> Checkpoints stehen an versteckten Stellen. Fahre nahe heran, um sie zu aktivieren. Bergen bringt nur dein Fahrzeug zum letzten gefundenen Lager zurück; Gegenstände und gelöste Aufgaben bleiben erhalten. Beim nächsten Spielstart geht es ebenfalls am letzten gefundenen Lager weiter. In der Pause kannst du bewegliche Gegenstände in deiner Nähe zurücksetzen.</li></ol><p class="modal-copy">Tastatur: D / → Gas, A / ← rückwärts, W / S lenken, Q / E Gewicht, Leertaste bremsen, Esc pausieren. Kein Zeitlimit.</p><button class="primary-button full" id="help-done">Los geht’s ${svg('arrow')}</button>`);$('help-done').onclick=closeModal;
}
function finish(){
  const relics=[...sim.collected].filter(id=>id.startsWith('relic-')),record=completedRecord(saved.records[currentLevel],sim.finishTime,sim.rescues,relics),stars=1+Number(sim.rescues===0)+Number(relics.length===3);saved.records[currentLevel]=record;delete saved.runs[currentLevel];persist();setState('finished');resumeState=null;sound.beep(880,.3);
  openModal(`<p class="eyebrow dark">GEBIET GESCHAFFT</p><h2 id="modal-title">Im Lager angekommen.</h2><div class="result-stars">${'★'.repeat(stars)}<span>${'☆'.repeat(3-stars)}</span></div><div class="result-stats"><div><strong>${sim.rescues}</strong><small>BERGUNGEN</small></div><div><strong>${relics.length}/3</strong><small>FUNDSTÜCKE</small></div><div><strong>${formatTime(sim.elapsed)}</strong><small>UNTERWEGS</small></div></div><button class="primary-button full" id="next-level">${currentLevel<WORLD_COUNT-1?'Nächstes Gebiet':'Gebiete entdecken'} ${svg('arrow')}</button><button class="secondary-button full" id="finish-home">Zur Auswahl</button>`,false);
  $('next-level').onclick=()=>{modal.close();if(currentLevel<WORLD_COUNT-1){loadLevel(currentLevel+1);begin();}else{loadLevel(0);showCourses();}};$('finish-home').onclick=()=>{modal.close();loadLevel(currentLevel);showCourses();};
}
$('start-button').onclick=begin;$('choose-course').onclick=()=>{if(state!=='loading')showCourses();};$('settings-button').onclick=()=>{if(state!=='loading')showSettings();};$('pause-button').onclick=showPause;$('home-button').onclick=()=>{if(state==='racing'||state==='countdown')showPause();else if(state!=='loading'){modal.close();loadLevel(currentLevel);}};
$('rescue-button').onclick=()=>{if(state!=='racing')return;controls.reset();sim.rescue();accumulator=0;renderer.snapNextFrame=true;toast(sim.checkpoint.id==='start'?'Zurück am Startlager':'Zurück am gefundenen Lager');};
$('interact-button').onclick=()=>{if(state==='racing'&&!sim.interact())toast('Zum Bedienen kurz anhalten.');};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state==='racing'||state==='countdown')showPause();sound.update(0,false);pads.forEach(p=>p.cancel());}accumulator=0;});
window.addEventListener('pagehide',saveRun);
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!modal.open&&state==='racing'){e.preventDefault();showPause();}});window.addEventListener('focus',()=>{if(state==='racing')tilt.resume();});
window.addEventListener('offline',()=>toast('Offline unterwegs · dein Spiel läuft weiter.'));
function updateHud(){
  $('interact-button').hidden=state!=='racing'||!sim.nearbySwitch;
  $('speed').textContent=String(Math.round(Math.abs(sim.signedSpeed)*3.6));$('checkpoint-label').textContent=sim.checkpoint.id==='start'?'STARTLAGER':'LAGER ENTDECKT';
  $('finds').textContent=`${sim.availableCells} ◈ · ${sim.activatedRelays.size}/${sim.level.relays.length} ⚡ · ${[...sim.collected].filter(c=>c.startsWith('relic')).length}/3 ◇`;
  $('radar-sector').style.transform=`rotate(${sim.radar.angle}rad)`;$('radar-distance').textContent=sim.radar.band;
  for(const event of sim.events.splice(0))if(event.kind==='camp')toast('Verstecktes Lager entdeckt · Checkpoint gesetzt');else if(event.kind==='cache')toast(event.id.startsWith('relic')?'Fundstück gesichert':'Energiezelle gefunden');else if(event.kind==='relay')toast('Generator versorgt');else if(event.kind==='switch')toast(sim.signals.has(event.id)?'Ventil geöffnet':'Ventil geschlossen');else if(event.kind==='goal')toast(`Ziellager ohne Strom · ${sim.activatedRelays.size}/${sim.level.relays.length} Generatoren versorgt`);
}
function offlineReady(){$('offline-status').innerHTML='<i class="ready"></i> OFFLINE BEREIT';}
function reloadForUpdate(){if(updateRequested){updateRequested=false;location.reload();}}
async function applyGameUpdate(){saveRun();resumeState=null;try{const registration=await navigator.serviceWorker.getRegistration();if(!registration?.waiting){location.reload();return;}updateRequested=true;await updateSW(true);}catch{updateRequested=false;toast('Update konnte nicht geladen werden.');}}
function offerUpdate(){
  updateReady=true;toast('Neue Version verfügbar · in den Einstellungen laden.');
  // Installation may finish while Settings is already open. Update that view
  // immediately instead of requiring the player to close and reopen it.
  const links=document.querySelector('.settings-links');
  if(links&&!$('apply-update')){const button=document.createElement('button');button.id='apply-update';button.textContent='Neue Version laden ↗';button.onclick=applyGameUpdate;links.append(button);}
}
const updateSW=registerSW({onOfflineReady:offlineReady,onNeedReload:reloadForUpdate,onNeedRefresh:offerUpdate,onRegisterError(error){console.error(error);$('offline-status').textContent='ONLINE-MODUS';}});
if('serviceWorker'in navigator){navigator.serviceWorker.ready.then(offlineReady).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',reloadForUpdate);}
async function boot(){
  try{
    renderer=new WorldRenderer($('scene'));renderer.setQuality(saved.quality);renderer.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(state==='racing')showPause();toast('Grafik unterbrochen · bitte neu laden.');});
    await Promise.all([initWorldPhysics(),renderer.load(p=>{($('loading-bar').firstElementChild as HTMLElement).style.width=`${p*100}%`;})]);
    loadLevel(currentLevel);$<HTMLButtonElement>('start-button').disabled=false;$('loading-bar').hidden=true;
    if(migrated)toast('Neue Welt · alter Fortschritt zurückgesetzt. Einstellungen übernommen.');
    let previous=performance.now();
    const frame=(now:number)=>{
      const dt=Math.min((now-previous)/1000,.1);previous=now;
      if(!document.hidden){
        if(state==='countdown'){countdown-=Math.max(0,(now-countdownUpdated)/1000);countdownUpdated=now;$('countdown').textContent=String(Math.max(1,Math.ceil(countdown)));if(countdown<=0)setState('racing');}
        if(state==='racing'){
          controls.update();const motion=tilt.read(now);sim.weightTarget=controls.weight??motion?.weight??(tilt.active?0:+$<HTMLInputElement>('ballast').value);sim.steering=-(controls.steering??motion?.steer??(tilt.active?0:+$<HTMLInputElement>('steering').value));
          accumulator+=dt;let steps=0;while(accumulator>=WORLD_DT&&steps<9){sim.tick();accumulator-=WORLD_DT;steps++;}if(steps===9)accumulator=Math.min(accumulator,WORLD_DT);if(sim.finished)finish();
        }
        if(state==='racing'||state==='countdown'||renderer.needsFrame(sim))renderer.render(sim,dt);
        sound.update(sim.wheels[0].spin,state==='racing');if(now-lastHud>100){updateHud();lastHud=now;}if(now-lastSave>12000&&state==='racing'){saveRun();lastSave=now;}
      }
      requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
    if(import.meta.env.DEV||new URL(location.href).searchParams.has('test'))(window as any).__FORMDRIVE__={
      snapshot:()=>({...sim.snapshot(),state,level:currentLevel,drafts:pads.map(p=>p.draft),mounted:pads.map(p=>p.shape),axleRevisions:sim.shapeRevisions,tuning:{weightTarget:sim.weightTarget,steering:sim.steering,gyro:{active:tilt.active,weight:tilt.filter.weight,steer:tilt.filter.steer}},controls:{drive:sim.drive,brake:sim.brake,cruise:controls.cruise},render:renderer.renderer.info.render,memory:renderer.renderer.info.memory,terrainTiles:sim.tiles.size,framing:renderer.framing()}),
      level:()=>sim.level,load:(id:number)=>loadLevel(clamp(id,0,WORLD_COUNT-1)),draft:(axle:number,shape:Point[])=>{pads[axle].draft=shape;pads[axle].render();},
      shape:(name:ShapeName)=>pads.forEach(p=>p.usePreset(name)),
      inspect:(x:number,z:number,heading=0)=>{setState('paused');sim.teleport({x,z,y:worldHeight(sim.level,x,z)},heading);sim.started=true;for(let i=0;i<110;i++)sim.tick();sim.started=false;renderer.snapNextFrame=true;renderer.render(sim,.1);updateHud();},
      drive:(value:number,steer=0,weight=0)=>{sim.drive=clamp(value,-1,1);sim.steering=clamp(steer,-1,1);sim.weightTarget=clamp(weight,-1,1);},
      resume:()=>{accumulator=0;setState('racing');},
      step:(steps:number)=>{sim.started=true;for(let i=0;i<Math.min(steps,15000);i++)sim.tick();sim.started=state==='racing';renderer.snapNextFrame=true;renderer.render(sim,.1);updateHud();},
      resizeWheels:(rear:number,front:number)=>{sim.setWheelSize(0,rear);sim.setWheelSize(1,front);},
      moveProp:(id:string,x:number,y:number,z:number)=>{const p=sim.props.find(p=>p.spec.id===id);if(p?.spec.movable){sim.ensureTerrain(x,z,1);p.body.setTranslation({x,y,z},true);p.body.setLinvel({x:0,y:0,z:0},true);}},
      save:()=>saved,sceneImage:()=>{renderer.render(sim,0);return renderer.image();},
    };
  }catch(error){console.error(error);$('loading-bar').hidden=true;$('start-button').innerHTML='<span>Noch einmal laden</span>';$<HTMLButtonElement>('start-button').disabled=false;$('start-button').onclick=()=>location.reload();toast('Die Welt konnte nicht geladen werden. Bitte lade erneut.');}
}
matchMedia('(orientation:portrait)').addEventListener('change',e=>{if(e.matches&&(state==='racing'||state==='countdown'))showPause();pads.forEach(p=>p.cancel());controls.reset();});
boot();

function showSettings() {
  openModal(`<p class="eyebrow dark">DEIN COCKPIT</p><h2 id="modal-title">Feinabstimmung.</h2><div class="setting-row"><div><strong>Motor & Signale</strong><small>Ton lässt sich jederzeit ausschalten.</small></div><button class="toggle ${saved.sound ? 'on' : ''}" id="sound-toggle" role="switch" aria-checked="${saved.sound}" aria-label="Spielton"><i></i></button></div><div class="setting-block"><strong>Grafikqualität</strong><div class="segmented">${(['auto', 'high', 'eco'] as const).map(q => `<button data-quality="${q}" class="${saved.quality === q ? 'active' : ''}" aria-pressed="${saved.quality === q}">${q === 'auto' ? 'Automatisch' : q === 'high' ? 'Detailreich' : 'Sparsam'}</button>`).join('')}</div><p>Automatisch passt Auflösung und Schatten an die gemessene Bildrate an.</p></div><div class="settings-links"><button id="install-help">${svg('save')} Auf dem iPhone installieren ${svg('arrow')}</button><button id="help-button">${svg('info')} So funktioniert’s ${svg('arrow')}</button><a href="${import.meta.env.BASE_URL}credits.html" target="_blank" rel="noopener">${svg('info')} Quellen & Physik ${svg('arrow')}</a>${updateReady ? '<button id="apply-update">Neue Version laden ↗</button>' : ''}</div><p class="version">FORMDRIVE 2.1.0 · Spielstand auf diesem Gerät</p>`);
  $('sound-toggle').onclick = () => { saved.sound = !saved.sound; sound.enabled = saved.sound; sound.unlock().catch(() => {}); persist(); const b = $('sound-toggle'); b.classList.toggle('on', saved.sound); b.setAttribute('aria-checked', String(saved.sound)); };
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b => b.onclick = () => {
    saved.quality = b.dataset.quality as WorldSave['quality']; renderer.setQuality(saved.quality); persist();
    document.querySelectorAll('[data-quality]').forEach(el => { const active = (el as HTMLElement).dataset.quality === saved.quality; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
  });
  $('install-help').onclick = showInstall;
  $('help-button').onclick = showHelp;
  if (updateReady) $('apply-update').onclick = applyGameUpdate;
}

function showInstall() {
  openModal(`<p class="eyebrow dark">DEIN SPIEL. IMMER DABEI.</p><h2 id="modal-title">Aufs iPhone.</h2><ol class="help-list"><li>Öffne diese Spieladresse in <strong>Safari</strong>.</li><li>Tippe auf <strong>Teilen</strong> und dann <strong>Zum Home-Bildschirm</strong>.</li><li>Lass <strong>Als Web-App öffnen</strong> eingeschaltet und tippe auf <strong>Hinzufügen</strong>.</li><li>Starte FORMDRIVE über das neue Icon und warte auf <strong>Offline bereit</strong>.</li></ol><p class="modal-copy">Danach kannst du auch ohne Verbindung spielen. Für den ersten Start werden die Strecke, Texturen und Physik heruntergeladen. Browserdaten zu löschen entfernt auch den lokalen Spielstand.</p><button class="primary-button full" id="install-done">Verstanden ${svg('check')}</button>`);
  $('install-done').onclick = closeModal;
}
