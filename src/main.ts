import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { createExpedition, expeditionList as courseList, EXPEDITION_COUNT, zoneAt } from './courses';
import { DriveControls } from './drive-controls';
import { TiltControls } from './tilt-controls';
import { expeditionStars, recordExpedition, restoreExpeditions, type ExpeditionRecord } from './expedition';
import { DrawingPad } from './drawing';
import { GameAudio } from './audio';
import { GameRenderer } from './renderer';
import { initPhysics, Simulation, FIXED_DT } from './physics';
import { clamp, preset, restoreShape, type Point, type ShapeName } from './shapes';

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
};
const svg = (key: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
interface Saved { level: number; best: Record<number, { time: number; stars: number }>; expeditions: Record<number, ExpeditionRecord>; favorite: Point[] | null; sound: boolean; quality: 'auto' | 'high' | 'eco'; tutorial: boolean; expeditionTutorial: boolean }
const defaultSave = (): Saved => ({ level: 0, best: {}, expeditions: {}, favorite: null, sound: false, quality: 'auto', tutorial: false, expeditionTutorial: false });
let saved: Saved = defaultSave();
try {
  const raw = JSON.parse(localStorage.getItem('formdrive.v1') ?? 'null');
  if (raw && typeof raw === 'object') {
    saved.level = Number.isInteger(raw.level) ? clamp(raw.level, 0, EXPEDITION_COUNT - 1) : 0;
    saved.sound = raw.sound === true; saved.tutorial = raw.tutorial === true;
    saved.expeditions = restoreExpeditions(raw.expeditions); saved.expeditionTutorial = raw.expeditionTutorial === true;
    if (['auto', 'high', 'eco'].includes(raw.quality)) saved.quality = raw.quality;
    if (raw.favorite) saved.favorite = restoreShape(raw.favorite);
    if (raw.best && typeof raw.best === 'object') for (const [id, value] of Object.entries(raw.best) as [string, { time: number; stars: number }][]) {
      if (+id >= 0 && +id < 13 && Number.isFinite(value?.time) && value.time > 0) saved.best[+id] = { time: value.time, stars: clamp(value.stars || 1, 1, 3) };
    }
  }
} catch { /* Private browsing and corrupt saves get a playable in-memory fallback. */ }
function persist() { try { localStorage.setItem('formdrive.v1', JSON.stringify(saved)); } catch { toast('Dein Browser kann den Spielstand gerade nicht speichern.'); } }

const axleSlider=(axle:string)=>`<label class="wheel-slider" aria-label="${axle==='rear'?'Hinterachse':'Vorderachse'}"><span aria-hidden="true">◇</span><input id="stiffness-${axle}" type="range" min="0" max="1" step="0.05" value="1" aria-label="Steifigkeit ${axle==='rear'?'Hinterachse':'Vorderachse'}" aria-valuetext="Starr"><span aria-hidden="true">〰</span><output id="stiffness-${axle}-value" hidden>Starr</output></label>`;
document.querySelector('#app')!.innerHTML = `
<main class="game" aria-label="FORMDRIVE Physik-Abenteuer">
  <section class="stage" id="stage">
    <div id="scene"></div><div class="scene-vignette"></div>
    <header class="topbar">
      <button class="wordmark" id="home-button" aria-label="Zur Startansicht">FORM<span>DRIVE</span><i></i></button>
      <div class="top-actions"><button class="icon-button" id="tune-button" aria-label="Fahrwerk einstellen" aria-controls="tune-panel" aria-expanded="false">${svg('tune')}</button><button class="icon-button" id="pause-button" aria-label="Spiel pausieren" hidden>${svg('pause')}</button><button class="icon-button" id="settings-button" aria-label="Einstellungen">${svg('settings')}</button></div>
    </header>
    <div class="race-hud" id="race-hud" hidden>
      <div class="race-row"><div class="position"><strong id="progress-value">0</strong><span>%<br>WEG</span></div><div class="race-title"><span id="race-region">EXPEDITION / 01</span><strong id="race-name">Zum Basislager</strong></div><div class="timer"><strong id="finds">0</strong><span>BERGUNGEN</span></div></div>
      <div class="progress-track"><div id="progress-fill"></div><i id="progress-dot"></i></div>
      <div class="journey-note"><span id="checkpoint-label">STARTLAGER</span><span id="journey-goal">ERREICHE DAS ZIELLAGER</span></div>
    </div>
    <div class="home-content" id="home-content">
      <div class="home-heading"><p class="eyebrow"><i></i> DEINE EXPEDITION</p><h1>FORM<br><em>DRIVE.</em></h1><p class="home-tagline">Schaffst du den Weg?<br>Fahre. Zeichne. Klettere.</p></div>
      <div class="home-bottom"><button class="course-preview" id="choose-course"><span class="course-number" id="course-number">01</span><span><small id="course-region">CANYON</small><strong id="course-name">Zum Basislager</strong></span>${svg('grid')}</button><button class="primary-button" id="start-button" disabled><span>Welt wird geladen …</span><b>${svg('arrow')}</b></button><div class="home-meta"><span id="offline-status"><i></i> WIRD VORBEREITET</span><span>21 EXPEDITIONEN · KEIN ZEITLIMIT</span></div></div>
    </div>
    <div class="drive-info" id="drive-info" hidden><div class="speed"><strong id="speed">0</strong><span>KM/H</span></div><div class="terrain-chip"><i></i><span id="terrain-label">FESTER BODEN</span></div><button class="rescue-button" id="rescue-button" aria-label="Zum letzten Checkpoint zurücksetzen">${svg('reset')}<span>BERGEN</span></button></div>
    <div class="countdown" id="countdown" hidden>3</div>
    <div class="loading-bar" id="loading-bar"><span></span></div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
    <section class="tune-panel" id="tune-panel" aria-label="Fahrwerk" hidden>
      <div class="tune-heading"><strong>Neigungssteuerung</strong><button id="close-tune" aria-label="Fahrwerk schließen">${svg('close')}</button></div>
<p class="tilt-copy">Links / rechts kippen: Gewicht verlagern.<br>Vor / zurück kippen: seitlich lenken.</p><button class="sensor-button" id="gyro-enable">Neigung aktivieren</button><div class="sensor-actions"><button id="gyro-calibrate" disabled>Neutralstellung</button><button id="gyro-disable" disabled>Aus</button></div><p id="gyro-status" role="status">Aus · auch mit Touch spielbar</p>
      <label for="ballast">Gewicht <output id="ballast-value">Mitte</output></label><input id="ballast" type="range" min="-1" max="1" step="0.1" value="0" aria-label="Gewicht nach hinten oder vorne verlagern">
<div class="tune-ends"><span>← Hinten</span><span>Vorne →</span></div><label for="steering">Lenken ohne Sensoren</label><input id="steering" type="range" min="-1" max="1" step="0.05" value="0" aria-label="Seitlich lenken"><div class="tune-ends"><span>In die Tiefe</span><span>Nach vorne</span></div>
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

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const modal = $<HTMLDialogElement>('modal');
const sound = new GameAudio(); sound.enabled = saved.sound;
let sim: Simulation;
let renderer: GameRenderer;
let currentLevel = saved.level;
let state: 'loading' | 'home' | 'countdown' | 'racing' | 'paused' | 'finished' = 'loading';
let resumeState: 'racing' | 'countdown' | null = null;
let countdown = 3;
let countdownUpdated = 0;
let accumulator = 0;
let toastTimer: ReturnType<typeof setTimeout>;
let updateReady = false;
let updateRequested = false;
let lastTerrain = '';
let lastResetCount = 0;

let lastCheckpoint = 2;
let lastHud = 0;
let slow = false;
function toast(message: string) {
  $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
const pads = ['rear', 'front'].map((name, axle) => {
  let pad: DrawingPad;
  const refresh = () => {
    if (!pad) return;
    const button = $<HTMLButtonElement>(`mount-${name}`);
    button.disabled = !pad.enabled || !pad.dirty || pad.busy || pad.active;
    button.classList.toggle('preparing', pad.busy);
    button.setAttribute('aria-busy', String(pad.busy));
    button.setAttribute('title', pad.busy ? 'Rad wird vorbereitet' : `${axle ? 'Vorderräder' : 'Hinterräder'} montieren`);
  };
  pad = new DrawingPad($<HTMLCanvasElement>(`drawing-${name}`), shape => !sim || sim.requestShape(shape, 0, axle), toast, refresh);
  $(`mount-${name}`).onclick = () => { if (!modal.open) void pad.mount(); };
  $(`undo-${name}`).onclick = () => { if (pad.enabled) pad.undo(); };
  $(`clear-${name}`).onclick = () => { if (pad.enabled) pad.clear(); };
  return pad;
});
const controls = new DriveControls($('drive-controls'), (drive, brake) => { if (sim) { sim.cars[0].drive = drive; sim.cars[0].brake = brake; } }, () => sim?.cars[0].body.linvel().x ?? 0);
function toggleTune(open:boolean){$('tune-panel').hidden=!open;$('tune-button').setAttribute('aria-expanded',String(open));}
$('tune-button').onclick=()=>{if(sim)toggleTune(!!$('tune-panel').hidden);};$('close-tune').onclick=()=>toggleTune(false);
for(const [i,name] of ['rear','front'].entries()){const input=$<HTMLInputElement>('stiffness-'+name);input.oninput=()=>{const v=+input.value;if(sim)sim.cars[0].flex[i].stiffness=v;const label=v>.95?'Starr':v<.2?'Weich':Math.round(v*100)+' %';$('stiffness-'+name+'-value').textContent=label;input.setAttribute('aria-valuetext',label);};input.addEventListener('keydown',e=>e.stopPropagation());}
$('ballast').oninput=()=>{const v=+$<HTMLInputElement>('ballast').value;if(sim)sim.cars[0].ballastTarget=v;$('ballast-value').textContent=Math.abs(v)<.05?'Mitte':v<0?'Hinten':'Vorne';};
$('tune-panel').addEventListener('keydown',e=>e.stopPropagation());
const tilt=new TiltControls(()=>{$('gyro-status').textContent=tilt.status;$<HTMLButtonElement>('gyro-calibrate').disabled=!tilt.active;$<HTMLButtonElement>('gyro-disable').disabled=!tilt.active;$('tune-button').classList.toggle('sensor-active',tilt.active);});
$('gyro-enable').onclick=()=>{void tilt.enable();};$('gyro-calibrate').onclick=()=>tilt.calibrate();$('gyro-disable').onclick=()=>{tilt.disable();if(sim){sim.cars[0].ballastTarget=0;sim.cars[0].lateral.input=0;}};
$('steering').oninput=()=>{if(sim)sim.cars[0].lateral.input=+$<HTMLInputElement>('steering').value;};
function releaseSteering(){$<HTMLInputElement>('steering').value='0';if(sim)sim.cars[0].lateral.input=0;}
for(const event of ['pointerup','pointercancel','blur'])$('steering').addEventListener(event,releaseSteering);

const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const courseNumber = (id: number) => id === 12 ? '∞' : String(id > 12 ? id : id + 1).padStart(2, '0');
const region = (id: number) => id === 12 ? 'EXPERIMENT' : id >= 16 ? 'ABENTEUER' : id > 12 ? 'EXPERTE' : id < 4 ? 'CANYON' : id < 8 ? 'GLETSCHER' : 'STEINBRUCH';

function setState(next: typeof state) {
  state = next;
  if (next === 'countdown') countdownUpdated = performance.now();
  const home = state === 'home' || state === 'loading';
  $('home-content').hidden = !home; $('race-hud').hidden = home; $('drive-info').hidden = home;
  $('pause-button').hidden = home || state === 'finished'; $('countdown').hidden = state !== 'countdown';
  $('drive-controls').classList.toggle('not-driving', home || state === 'finished');
  controls.enabled = state === 'racing';
  if (!controls.enabled){controls.reset();tilt.suspend();releaseSteering();}else tilt.resume();
  for (const pad of pads) { pad.enabled = state !== 'loading' && state !== 'finished'; if (!pad.enabled) pad.cancel(); else pad.render(); }
  if (sim) sim.started = state === 'racing';
  if(next==='paused'||next==='finished')toggleTune(false);
  document.querySelector('.game')!.setAttribute('data-state', state);
}

function loadLevel(id: number, stayHome = true) {
  pads.forEach(pad => pad.cancel());
  sim?.dispose(); currentLevel = id; saved.level = id;
  sim = new Simulation(createExpedition(id), 1, pads.map(pad => pad.shape)); renderer.setCourse(sim);
  toggleTune(false);for(const name of ['rear','front']){$<HTMLInputElement>('stiffness-'+name).value='1';$('stiffness-'+name+'-value').textContent='Starr';}$<HTMLInputElement>('ballast').value='0';$('ballast-value').textContent='Mitte';
  document.querySelector<HTMLElement>('.game')!.dataset.theme=sim.course.theme;
  accumulator = 0; lastResetCount = 0; lastTerrain = ''; slow = false;
   lastCheckpoint = 2;
  clearTimeout(toastTimer); $('toast').classList.remove('visible');
  $('course-number').textContent = courseNumber(id);
  $('course-region').textContent = `${region(id)} · EXPEDITION`;
  $('course-name').textContent = sim.course.name;
  $('race-region').textContent = `${region(id)} / ${id === 12 ? 'FREIES FAHREN' : courseNumber(id)}`;
  $('race-name').textContent = sim.course.name;
  $('journey-goal').textContent = id === 12 ? 'FREI EXPERIMENTIEREN' : 'ERREICHE DAS ZIELLAGER';
  persist(); setState(stayHome ? 'home' : 'countdown');
  renderer.render(sim, .016, stayHome);
}

function begin() {
  if (state === 'loading') return;
  if (pads.some(pad => !pad.shape.length)) { toast('Zeichne für beide Achsen eine Form und bestätige mit den Häkchen.'); return; }
  const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
  orientation.lock?.('landscape').catch(() => {});
  sound.unlock().catch(() => {});
  countdown = 3; accumulator = 0; $('countdown').textContent = '3'; setState('countdown');
  if (!saved.expeditionTutorial) {
    saved.expeditionTutorial = true; persist();
    toast('Rechts Gas, links bremsen und zurück. Wische am Gas nach oben für den Tempomat.');
  }
}

function openModal(content: string, canResume = true) {
  if (state === 'racing' || state === 'countdown') { resumeState = canResume ? state : null; setState('paused'); }
  $('modal-content').innerHTML = content;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  modal.close();
  if (resumeState) { const next = resumeState; resumeState = null; accumulator = 0; setState(next); }
  else if (state === 'finished') loadLevel(currentLevel);
}
modal.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
$('close-modal').onclick = closeModal;

function showPause() {
  if (state !== 'racing' && state !== 'countdown') return;
  openModal(`<p class="eyebrow dark">KURZE AUSZEIT</p><h2 id="modal-title">Durchatmen.</h2><p class="modal-copy">${sim.course.name} · ${formatTime(sim.elapsed)}</p><button class="primary-button full" id="resume-game">Weiterfahren ${svg('arrow')}</button><div class="button-pair"><button class="secondary-button" id="restart-game">Neu starten</button><button class="secondary-button" id="back-home">Streckenauswahl</button></div>${currentLevel === 12 ? `<button class="secondary-button full" id="slow-toggle">Zeitlupe ${slow ? 'ausschalten' : 'einschalten'}</button>` : ''}`);
  $('resume-game').onclick = closeModal;
  $('restart-game').onclick = () => { resumeState = null; modal.close(); loadLevel(currentLevel); begin(); };
  $('back-home').onclick = () => { resumeState = null; modal.close(); loadLevel(currentLevel); showCourses(); };
  if (currentLevel === 12) $('slow-toggle').onclick = () => { slow = !slow; closeModal(); toast(slow ? 'Zeitlupe aktiv' : 'Normale Geschwindigkeit'); };
}

function showCourses() {
  openModal(`<p class="eyebrow dark">DEIN NÄCHSTES ABENTEUER</p><h2 id="modal-title">Wähle deinen Weg.</h2><p class="modal-copy">Erreiche das Ziellager. Ein Stern fürs Ziel, ein zweiter für eine Fahrt ohne Bergung. Kein Zeitlimit. Alle Expeditionen sind frei wählbar.</p><div class="course-list">${courseList.filter(c => c.id !== 12).concat(courseList[12]).map(c => { const id = c.id; return `${id === 16 ? '<h3 class="collection-label">NEUE MECHANIK-ABENTEUER</h3>' : id === 13 ? '<h3 class="collection-label">EXPERTENEXPEDITIONEN</h3>' : id % 4 === 0 && id < 12 ? `<h3 class="collection-label">${region(id)} <span>0${id / 4 + 1}</span></h3>` : ''}<button class="level-card ${id === currentLevel ? 'active' : ''}" data-level="${id}"><span class="level-no">${courseNumber(id)}</span><span class="level-text"><strong>${c.name}</strong><small>${c.subtitle}</small></span><span class="level-record">${saved.expeditions[id] ? `<b>${'★'.repeat(expeditionStars(saved.expeditions[id]))}</b><small>GESCHAFFT${saved.expeditions[id].masterRoutes?.length ? ' · ◇ '+saved.expeditions[id].masterRoutes!.length : ''}${saved.expeditions[id].freightDelivered ? ' · FRACHT ✓' : ''}</small>` : id === 12 ? 'FREI' : '○'.repeat(c.difficulty)}</span></button>`; }).join('')}</div>`);
  document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(b => b.onclick = () => { resumeState = null; modal.close(); loadLevel(+b.dataset.level!); });
}

function showSettings() {
  openModal(`<p class="eyebrow dark">DEIN COCKPIT</p><h2 id="modal-title">Feinabstimmung.</h2><div class="setting-row"><div><strong>Motor & Signale</strong><small>Ton lässt sich jederzeit ausschalten.</small></div><button class="toggle ${saved.sound ? 'on' : ''}" id="sound-toggle" role="switch" aria-checked="${saved.sound}" aria-label="Spielton"><i></i></button></div><div class="setting-block"><strong>Grafikqualität</strong><div class="segmented">${(['auto', 'high', 'eco'] as const).map(q => `<button data-quality="${q}" class="${saved.quality === q ? 'active' : ''}" aria-pressed="${saved.quality === q}">${q === 'auto' ? 'Automatisch' : q === 'high' ? 'Detailreich' : 'Sparsam'}</button>`).join('')}</div><p>Automatisch passt die Auflösung an die gemessene Bildrate an.</p></div><div class="settings-links"><button id="install-help">${svg('save')} Auf dem iPhone installieren ${svg('arrow')}</button><button id="help-button">${svg('info')} So funktioniert’s ${svg('arrow')}</button><a href="${import.meta.env.BASE_URL}credits.html" target="_blank" rel="noopener">${svg('info')} Quellen & Physik ${svg('arrow')}</a>${updateReady ? '<button id="apply-update">Neue Version laden ↗</button>' : ''}</div><p class="version">FORMDRIVE 1.12.0 · Spielstand auf diesem Gerät</p>`);
  $('sound-toggle').onclick = () => { saved.sound = !saved.sound; sound.enabled = saved.sound; sound.unlock().catch(() => {}); persist(); const b = $('sound-toggle'); b.classList.toggle('on', saved.sound); b.setAttribute('aria-checked', String(saved.sound)); };
  document.querySelectorAll<HTMLButtonElement>('[data-quality]').forEach(b => b.onclick = () => {
    saved.quality = b.dataset.quality as Saved['quality']; renderer.setQuality(saved.quality); persist();
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
function showHelp() {
  openModal(`<p class="eyebrow dark">DEINE EXPEDITION</p><h2 id="modal-title">Finde deinen Weg.</h2><ol class="help-list"><li><strong>Erreiche das Ziellager.</strong> Es gibt keine Gegner und kein Zeitlimit. Das Ziel ist die Herausforderung. Eine Fahrt ohne Bergung erhält einen zusätzlichen Stern.</li><li><strong>Gas halten und dosieren.</strong> Rechts Gas halten: weiter oben am Pedal gibst du mehr Gas. Links bremsen; beim Stillstand weiter halten, um rückwärts zu fahren. Wische auf dem Gas nach oben für den Tempomat. Gas antippen oder bremsen beendet ihn.</li><li><strong>Zeichne deine Räder.</strong> Links zeichnest du die Hinterräder, rechts die Vorderräder. Setze beliebig ab und ergänze weitere Striche. Das Häkchen montiert den Entwurf auf der jeweiligen Achse und leert das Feld für die nächste Form. Der Pfeil entfernt den letzten Strich, das Kreuz leert das Feld. Dünne Speichen verbinden lose Striche mit der Achse.</li><li><strong>Experimentiere.</strong> Deine Kontur bestimmt Kontakt, Masse und Verdrängung. Es gibt keine fest vorgegebene Lösung für einen Abschnitt.</li><li><strong>Fahrwerk einstellen.</strong> Die senkrechten Regler außen neben den Zeichenfeldern ändern die Radsteifigkeit: oben starr, unten weich. Über das Achssymbol aktivierst du die Neigungssensoren. Halte das iPhone bequem und tippe auf Neutralstellung. Rechts/links kippen verlagert Gewicht, vor/zurück kippen lenkt seitlich. Ohne Sensoren stehen dort Touchregler bereit. Gas und Bremse verändern auch in der Luft die Neigung.</li><li><strong>Bewege die Welt.</strong> Druckplatten und Gegengewichte betätigst du mit dem Fahrzeug. Wasserstände und Strömungen wirken auf deine Konturen. Morsche Bohlen und dünnes Eis zeigen Schäden, bevor sie nachgeben. Lehm behält eingegrabene Spuren.</li><li><strong>Zusätzliche Ziele.</strong> Goldene Rauten markieren optionale Meisterrouten. Passiere ihre Markierungen der Reihe nach und erreiche das Ziel für eine Auszeichnung. Bei der Versorgungsfahrt muss die empfindliche Ladung heil ankommen. Der Zustand von Mechanismen, Ladung und Boden wird an Lagern gesichert.</li><li><strong>Festgefahren?</strong> Rolle zurück, zeichne eine andere Form oder tippe auf Bergen. Markierte Lager sichern deinen Fortschritt innerhalb der Fahrt.</li></ol><p class="modal-copy">Tastatur: D / → Gas, A / ← zurück, W / S seitlich lenken, Q / E Gewicht verlagern, Leertaste bremsen, Esc pausieren. Auf dem Testgelände gibt es Zeitlupe. Sterne bleiben über mehrere abgeschlossene Fahrten erhalten.</p><button class="primary-button full" id="help-done">Los geht’s ${svg('arrow')}</button>`);
  $('help-done').onclick = closeModal;
}

function finish() {
  const car = sim.cars[0], total = sim.course.caches?.length ?? 0;
  const run = recordExpedition(undefined, car.resets, sim.collected.size, total);
  const stars = expeditionStars(run);
  saved.expeditions[currentLevel] = recordExpedition(saved.expeditions[currentLevel], car.resets, sim.collected.size, total);
  saved.expeditions[currentLevel]=recordExpedition(saved.expeditions[currentLevel],car.resets,sim.collected.size,total,{masterRoutes:sim.mechanics.mastered,freightDelivered:!!sim.mechanics.cargo&&sim.mechanics.cargo.health>0});
  persist(); setState('finished'); resumeState = null; sound.beep(880, .3);
  const nextLevel = currentLevel === 11 ? 13 : currentLevel === 12 || currentLevel === EXPEDITION_COUNT - 1 ? null : currentLevel + 1;
  const checks: [string,boolean][] = [['Ziellager erreicht', true], ['Ohne Bergung angekommen', car.resets === 0]];
  for(const r of sim.course.masterRoutes??[])checks.push(['Meisterroute: '+r.name,sim.mechanics.mastered.includes(r.id)]);
  if(sim.mechanics.cargo)checks.push(['Fracht geliefert · '+Math.round(sim.mechanics.cargo.health)+' % unversehrt',sim.mechanics.cargo.health>0]);
  openModal(`<p class="eyebrow dark">${currentLevel === 12 ? 'TESTFAHRT ABGESCHLOSSEN' : 'EXPEDITION GESCHAFFT'}</p><h2 id="modal-title">Im Lager angekommen.</h2>${currentLevel!==12 ? `<div class="result-stars">${'★'.repeat(stars)}<span>${'☆'.repeat(2 - stars)}</span></div><ul class="mission-results">${checks.map(([label, done]) => `<li class="${done ? 'done' : ''}"><span>${done ? '✓' : '○'}</span>${label}</li>`).join('')}</ul>` : ''}<div class="result-stats"><div><strong>${car.resets}</strong><small>BERGUNGEN</small></div><div><strong>${car.shapeChanges}</strong><small>FORMWECHSEL</small></div><div><strong>${formatTime(car.finishTime)}</strong><small>UNTERWEGS</small></div></div><button class="primary-button full" id="next-level">${nextLevel !== null ? 'Nächste Expedition' : 'Expeditionen entdecken'} ${svg('arrow')}</button><div class="button-pair"><button class="secondary-button" id="race-again">Noch einmal</button><button class="secondary-button" id="finish-home">Zur Auswahl</button></div>`, false);
  $('next-level').onclick = () => { modal.close(); if (nextLevel !== null) { loadLevel(nextLevel); begin(); } else { loadLevel(0); showCourses(); } };
  $('race-again').onclick = () => { modal.close(); loadLevel(currentLevel); begin(); };
  $('finish-home').onclick = () => { modal.close(); loadLevel(currentLevel); showCourses(); };
}

$('start-button').onclick = begin;
$('choose-course').onclick = () => { if (state !== 'loading') showCourses(); };
$('settings-button').onclick = () => { if (state !== 'loading') showSettings(); };
$('pause-button').onclick = showPause;
$('home-button').onclick = () => { if (state === 'racing' || state === 'countdown') showPause(); else if (state !== 'loading') { if (modal.open) modal.close(); loadLevel(currentLevel); } };
$('rescue-button').onclick = () => { if (state !== 'racing') return; controls.reset(); sim.resetCar(); accumulator = 0; toast('Zurück am Checkpoint'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'racing' || state === 'countdown') showPause(); sound.update(0, false); pads.forEach(pad => pad.cancel()); } accumulator = 0; });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && !modal.open && state === 'racing') { e.preventDefault(); showPause(); } });
window.addEventListener('focus',()=>{if(state==='racing')tilt.resume();});
window.addEventListener('offline', () => toast('Offline unterwegs · dein Spiel läuft weiter.'));

function offlineReady() { $('offline-status').innerHTML = '<i class="ready"></i> OFFLINE BEREIT'; }
function reloadForUpdate() {
  if (!updateRequested) return;
  updateRequested = false; location.reload();
}
async function applyGameUpdate() {
  resumeState = null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    // Another tab may already have activated the update while this view was open.
    if (!registration?.waiting) { location.reload(); return; }
    updateRequested = true;
    await updateSW(true);
  } catch {
    updateRequested = false; toast('Das Update konnte nicht geladen werden. Versuche es erneut.');
  }
}
const updateSW = registerSW({
  onOfflineReady: offlineReady,
  onNeedReload: reloadForUpdate,
  onNeedRefresh() { updateReady = true; toast('Neue Version verfügbar · in den Einstellungen laden.'); },
  onRegisterError(error) { console.error('Offline installation failed', error); $('offline-status').textContent = 'ONLINE-MODUS'; }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(offlineReady).catch(() => {});
  // Workbox can classify an update to a worker installed during this same
  // document as a first installation. Native controllerchange covers it too.
  navigator.serviceWorker.addEventListener('controllerchange', reloadForUpdate);
}

async function boot() {
  try {
    renderer = new GameRenderer($('scene')); renderer.setQuality(saved.quality);
    renderer.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); if (state === 'racing' || state === 'countdown') showPause(); toast('Die Grafik wurde unterbrochen. Bitte lade die Seite neu.'); });
    await Promise.all([initPhysics(), renderer.load(p => { ($('loading-bar').firstElementChild as HTMLElement).style.width = `${p * 100}%`; })]);
    loadLevel(currentLevel);
    $<HTMLButtonElement>('start-button').disabled = false;
    $('start-button').innerHTML = `<span>Motor starten</span><b>${svg('arrow')}</b>`;
    $('loading-bar').hidden = true;
    if (import.meta.env.DEV) $('offline-status').innerHTML = '<i></i> LOKALE TESTVERSION';
    let previous = performance.now();
    function frame(now: number) {
      const dt = Math.min((now - previous) / 1000, .1); previous = now;
      if (!document.hidden) {
        if (state === 'countdown') {
          // The UI clock must not inherit the physics catch-up limit. A slow
          // renderer previously stretched three seconds into a long countdown.
          const before = Math.ceil(countdown); countdown -= Math.max(0, (now - countdownUpdated) / 1000); countdownUpdated = now;
          const n = Math.ceil(countdown); if (before !== n && n > 0) sound.beep(520, .09);
          $('countdown').textContent = String(Math.max(1, n));
          if (countdown <= 0) { setState('racing'); sound.beep(840, .2); }
        }
        if (state === 'racing') {
          controls.update();
          const motion=tilt.read(now),car=sim.cars[0];
          car.ballastTarget=controls.weight??motion?.weight??(tilt.active?0:+$<HTMLInputElement>('ballast').value);
          car.lateral.input=controls.steering??motion?.steer??(tilt.active?0:+$<HTMLInputElement>('steering').value);
          accumulator += dt * (slow ? .45 : 1);
          let steps = 0;
          while (accumulator >= FIXED_DT && steps < 12) { sim.tick(); accumulator -= FIXED_DT; steps++; }
          if (steps === 12) accumulator = Math.min(accumulator, FIXED_DT);
          if (sim.cars[0].finished) finish();
        }
        renderer.render(sim, dt, state === 'home');
        sound.update(sim.cars[0].wheels[0].angvel(), state === 'racing');
        if (now - lastHud > 100) { updateHud(); lastHud = now; }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // Explicit test mode exposes deterministic stepping for browser verification only.
    if (import.meta.env.DEV || new URL(location.href).searchParams.has('test')) {
      const previewSteps = (steps: number) => {
        sim.started = true; sim.cars[0].drive = 1;
        for (let i = 0; i < Math.min(steps, 20000); i++) { sim.tick(); if (i % 12 === 11) renderer.advanceEffects(sim, .1); }
      };
      (window as any).__FORMDRIVE__ = {
        steer:(input:number,offset?:number)=>{sim.cars[0].lateral.input=clamp(input,-1,1);if(offset!==undefined){sim.cars[0].lateral.offset=clamp(offset,-(sim.course.routes?.halfWidth??2.2)+1.15,(sim.course.routes?.halfWidth??2.2)-1.15);sim.steering.sync();}},
        tuning:(rear:number,front:number,ballast:number)=>{sim.cars[0].flex[0].stiffness=clamp(rear,0,1);sim.cars[0].flex[1].stiffness=clamp(front,0,1);sim.cars[0].ballastTarget=clamp(ballast,-1,1);},
        draft: (axle: number, shape: Point[]) => { pads[axle].draft = shape; pads[axle].render(); },
        framing: () => renderer.playerFraming(),
        inspect: (x:number,shape:ShapeName='compact',lateral=0)=>{setState('paused');pads.forEach(p=>p.usePreset(shape));sim.cars[0].checkpoint=x;sim.cars[0].lateral.checkpoint=lateral;sim.resetCar(0,false);for(let i=0;i<60;i++)sim.world.step();renderer.snapNextFrame=true;renderer.viewX=x;renderer.render(sim,1);updateHud();},
        course:()=>sim.course,
        scenery:()=>({goal:['goal-front','goal-back'].map(n=>{const o=renderer.scene.getObjectByName(n) as any;return o?{name:n,side:o.material.side,rotation:o.rotation.y}:null}),roofs:renderer.roofs.filter(r=>r.mesh.userData.passage).map(r=>({x:r.x,width:r.width,transparent:(r.mesh.material as any).transparent,faces:r.mesh.geometry.index?.count})),theme:sim.course.theme}),
        drive: (value: number, brake = 0) => { sim.cars[0].drive = clamp(value, -1, 1); sim.cars[0].brake = clamp(brake, 0, 1); },
        sceneImage: () => { renderer.render(sim, 0, state === 'home'); return renderer.renderer.domElement.toDataURL('image/png'); },
        snapshot: () => ({ mechanics:sim.mechanics.snapshot(),tuning:{flex:sim.cars[0].flex,ballast:sim.cars[0].ballast,ballastTarget:sim.cars[0].ballastTarget,lateral:sim.cars[0].lateral,gyro:{active:tilt.active,status:tilt.status,weight:tilt.filter.weight,steer:tilt.filter.steer}},state, level: currentLevel, time: sim.elapsed, carCount: sim.cars.length, collected: sim.collected.size, caches: sim.course.caches, controls: { drive: sim.cars[0].drive, brake: sim.cars[0].brake, cruise: controls.cruise }, drafts: pads.map(pad => pad.draft), player: { mud: sim.cars[0].mud, x: sim.cars[0].body.translation().x, y: sim.cars[0].body.translation().y, pitch: sim.cars[0].body.rotation(), water: sim.cars[0].water, shape: sim.cars[0].shape.length, shapes: sim.cars[0].shapes, axleRevisions: sim.cars[0].axleRevisions, motorTorques: sim.cars[0].motorTorques, revision: sim.cars[0].revision, resets: sim.cars[0].resets, finished: sim.cars[0].finished }, mudSpray: { count: renderer.mudSpray.activeCount, strengths: [...renderer.mudSpray.strengths] }, spray: { count: renderer.spray.activeCount, strengths: [...renderer.spray.strengths] }, render: renderer.renderer.info.render, geometry: renderer.renderer.info.memory, courseLength: sim.course.length }),
        step: (n: number) => { sim.started = true; for (let i = 0; i < Math.min(n, 20000); i++) sim.tick(); renderer.snapNextFrame = true; renderer.viewX = sim.cars[0].body.translation().x; renderer.render(sim, 1); },
        water: () => { const lake = sim.course.waters.find(w => w.deep && sim.course.zones.some(z => z.channel===w.channel && z.kind === 'lake' && z.start <= w.start && z.end >= w.end)) ?? sim.course.waters.find(w => w.deep)!; sim.cars[0].checkpoint = lake.start + 9;sim.cars[0].lateral.checkpoint=lake.lateral??0; pads.forEach(pad => pad.usePreset('paddle')); sim.resetCar(0, false); previewSteps(360); setState('paused'); renderer.snapNextFrame = true; renderer.viewX = sim.cars[0].body.translation().x; renderer.render(sim, 1); updateHud(); },
        load: (id: number) => loadLevel(clamp(id, 0, EXPEDITION_COUNT - 1)),
        preset: (name: ShapeName) => pads.forEach(pad => pad.usePreset(name)),
        obstacle: (kind: string, steps = 240, name: ShapeName = 'grip') => { const zone = sim.course.zones.find(z => z.kind === kind); if (!zone) return; setState('paused'); pads.forEach(pad => pad.usePreset(name)); sim.cars[0].checkpoint = zone.start - 2;sim.cars[0].lateral.checkpoint=zone.lateral??0; sim.resetCar(0, false); previewSteps(steps); sim.started = false; renderer.snapNextFrame = true; renderer.viewX = sim.cars[0].body.translation().x; renderer.render(sim, 1); updateHud(); },
        finish: () => { sim.cars[0].finished = true; sim.cars[0].finishTime = Math.max(1, sim.elapsed); finish(); }
      };
    }
  } catch (error) {
    console.error(error);
    $('loading-bar').hidden = true;
    $('start-button').innerHTML = `<span>Noch einmal laden</span><b>${svg('reset')}</b>`;
    $<HTMLButtonElement>('start-button').disabled = false; $('start-button').onclick = () => location.reload();
    $('home-content').classList.add('load-error');
    toast('Die 3D-Welt konnte nicht geladen werden. Prüfe die Verbindung und lade erneut.');
  }
}
function updateHud() {
  const car = sim.cars[0], p = car.body.translation();
  $('finds').textContent = String(car.resets);
  const routes=sim.course.masterRoutes?.length??0,cargo=sim.mechanics.cargo;
  if(cargo)$('journey-goal').textContent=cargo.health>0?'FRACHT '+Math.ceil(cargo.health)+' % · INS ZIEL BRINGEN':'FRACHT BESCHÄDIGT · BERGEN';
  else if(routes)$('journey-goal').textContent='◇ '+sim.mechanics.mastered.length+' / '+routes+' MEISTERROUTEN';
  $('checkpoint-label').textContent = car.checkpoint <= 2 ? 'STARTLAGER' : `LAGER ${sim.course.checkpoints.indexOf(car.checkpoint)}`;
  $('speed').textContent = String(Math.round(Math.abs(car.body.linvel().x) * 3.6));
  const progress = clamp(p.x / sim.course.length * 100, 0, 100);
  $('progress-value').textContent = String(Math.floor(progress));
  $('progress-fill').style.width = `${progress}%`; $('progress-dot').style.left = `${progress}%`;
  const zone = zoneAt(sim.course, p.x,car.lateral.offset); const terrain = zone?.label || 'FESTER BODEN';
  if (terrain !== lastTerrain) { $('terrain-label').textContent = terrain; lastTerrain = terrain; document.querySelector('.terrain-chip')!.classList.toggle('water', zone?.kind === 'lake' || zone?.kind === 'ford' || zone?.kind === 'causeway'); }
  if (state === 'racing' && car.resets > lastResetCount) { toast('Zurück am Checkpoint'); lastResetCount = car.resets; }
  if (state === 'racing' && car.checkpoint > lastCheckpoint) { toast('Lager erreicht · neuer Checkpoint'); lastCheckpoint = car.checkpoint; }
  $('rescue-button').classList.toggle('suggested', car.stuck > 3);
}
matchMedia('(orientation: portrait)').addEventListener('change', e => {
  if (e.matches && (state === 'racing' || state === 'countdown')) showPause();
  pads.forEach(pad => pad.cancel()); controls.reset();
});
boot();
