import './style.css';
import {BODY,HEAD,LANDINGS,defaults,shapePath,simulate} from './model.js';

const $=s=>document.querySelector(s);
const state={...defaults};
const help={
  landing:'Which outside face or edge of the closed case hits the floor first. Side and end choices set the tilt to 90° automatically.',
  base:'The broad bottom of the case lands first. The guitar presses into the bottom PU sheet.',
  lid:'The broad lid lands first. The guitar presses into the lid PU, especially near raised hardware.',
  left:'The long left edge lands first, as viewed from above with the headstock at the top. The body presses into the PE cradle.',
  right:'The long right edge lands first. The body presses into the PE cradle.',
  head:'The short end nearest the headstock lands first. The headstock may reach the existing end lining before the body cradle can help.',
  tail:'The short end nearest the pointed feet of the Beast body lands first. Those body tips press into the PE cradle.',
  drop:'How far the closed case falls before hitting the floor. Inches are measured vertically.',
  tilt:'0° means a broad face lands flat. 90° means a side or end lands first. Values between them split the impact between a face and an edge.',
  azimuth:'Which way the edge part of the impact points in the guitar drawing: 0° toward the headstock, 90° right, 180° toward the tail, and 270° left.',
  mass:'The guitar’s weight without the case. This starts at your stated 10 lb.',
  caseLength:'Usable space inside the closed case from the headstock end to the tail end.',
  caseWidth:'Usable space inside the case between its long left and right walls.',
  caseDepth:'Usable space between the inside of the wooden base and lid when closed.',
  guitarLength:'Distance from the headstock tip to the lowest body tip.',
  bodyWidth:'Distance across the two widest body points. This controls the traced outline’s scale.',
  bodyThickness:'Thickness of the wooden body, excluding raised bridge and pickups.',
  hardwareRise:'Estimated height of the bridge above the guitar body. On lid-first drops, this small raised area can press into the lid foam before the wood does.',
  puBottom:'Thickness of the soft polyurethane sheet beneath the guitar. Choose ½, ¾, or 1 inch.',
  puTop:'Thickness of the soft polyurethane sheet in the lid. Choose ½, ¾, or 1 inch.',
  peHeight:'Vertical height of the firmer polyethylene cutout wall around the body. This is different from its sideward width.',
  sideGap:'Space between the guitar body edge and the PE cutout before the guitar starts squeezing the PE.',
  endLiner:'Estimated thickness of the case’s existing padding at the headstock end. Its actual material is unknown; the model uses the soft PU curve as a stand-in.',
  maxPeWeb:'Maximum sideward span of PE that is actually backed by the case wall. Foam farther from the wall is ignored because it may move with the guitar instead of cushioning it.',
  pu25:'Pressure needed to squash your PU foam to 75% of its original thickness. Read this from a foam datasheet; psi means pounds of force per square inch.',
  pu50:'Pressure needed to squash your PU foam to half its original thickness.',
  pu70:'Pressure needed to squash your PU foam to 30% of its original thickness.',
  pe25:'Pressure needed to squash your PE foam to 75% of its original thickness.',
  pe50:'Pressure needed to squash your PE foam to half its original thickness.',
  g:'How strongly the guitar slows at the foam’s peak reaction. 1 g is the acceleration of gravity. If a foam spot fully compresses, the displayed value is only a lower bound.',
  lbf:'Pounds-force: a unit of push or pull. This is the total foam force along the impact direction, not the guitar’s weight. A hard-stop result is only a lower bound.',
  worst:'The area contributing the most force at the calculated instant. If foam fully compresses, this names the first hard-stop area instead.',
  contact:'Colored dots mark where the guitar pushes on foam. Hotter colors mean greater local foam pressure.',
  vector:'The direction in which the guitar moves relative to the stopped case during the impact.',
  zones:'Areas of the guitar grouped by the foam contact force they contribute.',
  stack:'A side view of the materials in the closed case. The PE cutout surrounds the body; the bottom and lid PU are separate sheets.',
  energy:'The motion energy the foam must absorb after the case stops. lb·in means pounds-force times inches; J means joules.',
  travel:'How far the guitar moves relative to the case along the impact direction before stopping or reaching a hard stop.',
  puCompression:'How much the most compressed bottom or lid PU spot shrinks, as a percent and in inches.',
  peCompression:'How much the most compressed PE side wall shrinks. The usable width varies around the guitar outline.',
  endCompression:'How much the assumed padding at the headstock end shrinks. This matters when the case lands headstock-first.',
  pressure:'The greatest pressure on any modeled foam contact. psi means pounds-force per square inch; this is not stress inside the guitar.',
  pu:'PU is polyurethane: the softer open-cell foam used under the guitar and in the lid.',
  pe:'PE is polyethylene: the firmer closed-cell foam cut into the body cradle.'
};
let tipCount=0;
function tip(key,label=key){const id=`help-${++tipCount}`;return `<span class="help-wrap"><button class="help-trigger" type="button" aria-label="Explain ${label}" aria-describedby="${id}" aria-expanded="false">?</button><span class="help-pop" id="${id}" role="tooltip">${help[key]}</span></span>`;}

function activeLanding(){return LANDINGS.find(x=>x.face===state.face&&x.tilt===state.tilt&&(state.tilt===0||x.azimuth===state.azimuth))?.id||null;}

const controls=[
  {id:'drop',label:'Drop height',unit:'in',min:1,max:60,step:1,group:'impact'},
  {id:'tilt',label:'Tilt from flat',unit:'°',min:0,max:90,step:1,group:'impact'},
  {id:'azimuth',label:'Edge direction',unit:'°',min:0,max:359,step:1,group:'impact'},
  {id:'mass',label:'Guitar weight',unit:'lb',min:4,max:16,step:.1,group:'fit'},
  {id:'caseLength',label:'Case inside length',unit:'in',min:42,max:51,step:.05,group:'fit'},
  {id:'caseWidth',label:'Case inside width',unit:'in',min:15,max:22,step:.05,group:'fit'},
  {id:'caseDepth',label:'Case inside depth',unit:'in',min:2.5,max:5,step:.05,group:'fit'},
  {id:'guitarLength',label:'Guitar overall length',unit:'in',min:39,max:47,step:.1,group:'fit'},
  {id:'bodyWidth',label:'Body maximum width',unit:'in',min:14,max:19,step:.1,group:'fit'},
  {id:'bodyThickness',label:'Body thickness',unit:'in',min:1.25,max:2.25,step:.05,group:'fit'},
  {id:'hardwareRise',label:'Bridge above body',unit:'in',min:0,max:.6,step:.05,group:'fit'},
  {id:'puBottom',label:'Bottom PU',unit:'in',min:.5,max:1,step:.25,group:'foam'},
  {id:'peHeight',label:'PE cradle height',unit:'in',min:.5,max:2,step:.05,group:'foam'},
  {id:'puTop',label:'Lid PU',unit:'in',min:.5,max:1,step:.25,group:'foam'},
  {id:'sideGap',label:'Body-to-cradle gap',unit:'in',min:0,max:.3,step:.01,group:'foam'},
  {id:'endLiner',label:'Head-end lining',unit:'in',min:.05,max:1,step:.05,group:'foam'},
  {id:'maxPeWeb',label:'Backed PE span',unit:'in',min:.5,max:10,step:.25,group:'foam'},
  {id:'pu25',label:'PU stress @ 25%',unit:'psi',min:.1,max:3,step:.05,group:'data'},
  {id:'pu50',label:'PU stress @ 50%',unit:'psi',min:.2,max:5,step:.05,group:'data'},
  {id:'pu70',label:'PU stress @ 70%',unit:'psi',min:.3,max:10,step:.05,group:'data'},
  {id:'pe25',label:'PE stress @ 25%',unit:'psi',min:2,max:20,step:.1,group:'data'},
  {id:'pe50',label:'PE stress @ 50%',unit:'psi',min:4,max:35,step:.1,group:'data'}
];

function field(c){
  return `<div class="field"><div class="field-top"><span class="term-label">${c.label} ${tip(c.id,c.label)}</span><span class="field-value"><input aria-label="${c.label}" type="number" inputmode="decimal" id="${c.id}-number" min="${c.min}" max="${c.max}" step="${c.step}" value="${state[c.id]}"><em>${c.unit}</em></span></div><input aria-label="${c.label} slider" type="range" id="${c.id}-range" min="${c.min}" max="${c.max}" step="${c.step}" value="${state[c.id]}">${c.id==='puBottom'||c.id==='puTop'?'<div class="thickness-stops"><span>½″</span><span>¾″</span><span>1″</span></div>':''}</div>`;
}

$('#app').innerHTML=`
  <header class="site-header"><div class="brand"><span class="brand-mark">B<span>×</span>C</span><span class="brand-copy">BEAST CASE <i>/</i> DROP LAB</span></div><div class="header-right"><span class="status-dot"></span> INTERACTIVE IMPACT ESTIMATE <span class="version">v1.0</span></div></header>
  <main>
    <section class="intro"><div><div class="eyebrow">CASE ENGINEERING / 01</div><h1>Where does the<br><em>impact go?</em></h1><p>Explore how a 10 lb B.C. Rich Beast loads the foam in a Rockcase RC 10625B. Set a drop, rotate the impact, and see which contact points work hardest.</p></div><div class="intro-stamp"><span>01</span><small>BUILD<br>THE FIT</small><div></div><span>02</span><small>TEST<br>THE DROP</small></div></section>
    <section class="workspace">
      <aside class="controls card"><div class="panel-title"><span>01 / INPUTS</span><button id="reset" class="text-button">RESET DEFAULTS ↺</button></div>
        <div class="control-section"><h2>Impact setup</h2><div class="landing-heading">Landing orientation ${tip('landing','landing orientation')}<span id="custom-angle" hidden>CUSTOM ANGLE</span></div><div class="landing-grid" role="group" aria-label="Landing orientation">${LANDINGS.map(x=>`<div class="landing-choice"><button type="button" data-landing="${x.id}">${x.label}</button>${tip(x.id,x.label)}</div>`).join('')}</div><div id="impact-fields"></div><div class="direction-key"><span>0° HEADSTOCK</span><span>90° RIGHT</span><span>180° TAIL</span><span>270° LEFT</span></div></div>
        <details class="control-section" open><summary>Instrument & case <span>⌄</span></summary><div id="fit-fields"></div><p class="micro-note">The case dimensions are catalog figures. Measure your specific case and guitar before cutting foam.</p></details>
        <details class="control-section"><summary>Foam stack & clearance <span>⌄</span></summary><div id="foam-fields"></div><p class="micro-note">The Beast rests on bottom PU through the PE cutout. PE contacts the body’s sides; lid PU contacts the front when dropped lid first.</p></details>
        <details class="control-section"><summary>Material data <span>⌄</span></summary><div class="presets"><button id="preset-pu">1.2 pcf PU sheet</button><button id="preset-pe">2.0 pcf PE sheet</button></div><div id="data-fields"></div><p class="micro-note">Enter compression force deflection values from your exact foam datasheets for a better estimate. Density alone does not set stiffness.</p></details>
      </aside>
      <div class="main-column">
        <section class="metrics"><article><span>PEAK DECELERATION ${tip('g','peak deceleration in g')}</span><strong id="metric-g">—</strong><small>g · case-relative estimate</small></article><article><span>PEAK REACTION ${tip('lbf','peak reaction in lbf')}</span><strong id="metric-force">—</strong><small>lbf · pounds-force toward stop</small></article><article><span>WORST CONTACT ${tip('worst','worst contact')}</span><strong id="metric-zone">—</strong><small id="metric-zone-detail">—</small></article></section>
        <section class="visual card"><div class="panel-title"><span>02 / CONTACT MAP ${tip('contact','contact map')}</span><div class="legend"><i class="legend-low"></i> LOW <i class="legend-high"></i> HIGH PRESSURE</div></div><div class="visual-body"><div class="map-wrap"><svg id="map" viewBox="150 0 300 600" role="img" aria-label="Top-down Beast guitar and case contact heat map"></svg></div><div class="visual-sidebar"><div class="impact-badge"><span>IMPACT VECTOR ${tip('vector','impact vector')}</span><strong id="vector-label">—</strong><small id="vector-detail">—</small></div><div class="load-list"><span class="small-label">FORCE BY CONTACT ZONE ${tip('zones','contact zone')}</span><div id="zones"></div></div><div class="map-note">Dots show local foam pressure at the instant of peak compression. Tap a dot for its contact details.</div></div></div><div class="map-tooltip" id="tooltip" hidden></div></section>
        <section class="under-grid"><article class="stack card"><div class="panel-title"><span>03 / LAYER STACK ${tip('stack','layer stack')}</span></div><div class="stack-vis"><div class="stack-shell">WOOD LID</div><div class="stack-lid"><span>TOP PU ${tip('pu','polyurethane')}</span><b id="top-thick">¾″</b></div><div class="stack-body"><div>GUITAR BODY <b id="body-thick">1¾″</b></div><div class="stack-pe">PE SIDE CRADLE ${tip('pe','polyethylene')}<br><b id="pe-thick">1⅛″</b></div></div><div class="stack-bottom"><span>BOTTOM PU ${tip('pu','polyurethane')}</span><b id="bottom-thick">¾″</b></div><div class="stack-shell">WOOD BASE</div></div><p id="stack-note" class="stack-note"></p></article>
          <article class="reading card"><div class="panel-title"><span>04 / READOUT</span></div><div class="read-row"><span>Impact energy ${tip('energy','impact energy')}</span><b id="energy">—</b></div><div class="read-row"><span>Travel along impact ${tip('travel','travel along impact')}</span><b id="travel">—</b></div><div class="read-row"><span>Max bottom/lid PU compression ${tip('puCompression','PU compression')}</span><b id="pu-compression">—</b></div><div class="read-row"><span>Max PE side compression ${tip('peCompression','PE compression')}</span><b id="pe-compression">—</b></div><div class="read-row"><span>Head-end lining compression ${tip('endCompression','head-end lining compression')}</span><b id="end-compression">—</b></div><div class="read-row"><span>Peak local pressure ${tip('pressure','peak local pressure')}</span><b id="pressure">—</b></div><div id="model-flag" class="model-flag"></div></article></section>
      </div>
    </section>
    <section class="method card"><div class="panel-title"><span>05 / METHOD & SOURCES</span><span>MODEL TRANSPARENCY</span></div><div class="method-grid"><div><h2>What the calculation does</h2><p>The guitar is modeled as a rigid 10 lb body. A grid samples the traced Beast body, while short segments sample the PE cutout wall. For each drop direction, the simulator integrates foam compression work until it equals the drop energy <code>weight × height</code>. It then sums contact forces along the impact direction.</p><p>Bottom and lid PU are separate contact layers. The PE only supports body edges; its sideward crush distance is the foam web to the case wall. The lid model includes a small raised-bridge contact patch. Neck support and headstock contact are approximate.</p></div><div><h2>Limits that matter</h2><p>This is an engineering screening model, not a validated drop test or a prediction of guitar breakage. It assumes a rigid case and guitar, a single impact pulse, uniform material response, and no latch, shell flex, rebound, rocking, or neck bending. Measured foam curves, an actual body tracing, internal case measurements, and instrumented tests are needed for reliable protection decisions.</p><p>When strain exceeds the last published data point (70% PU or 50% PE), the model extrapolates sharply and flags the result. Local pressure is pressure on foam, not stress inside the guitar wood.</p></div></div><div class="source-list"><h3>REFERENCE DATA</h3><a href="https://www.thomann.co.uk/rockcase_rc10625b_beast_jrv_case.htm" target="_blank" rel="noreferrer">Thomann: RC 10625B size, shell and 7 kg case weight ↗</a><a href="https://www.musicstore.com/de_LU/EUR/Rockcase-RC-10625-Case-fuer-Beast-JR-V-Black/art-GIT0007359-000" target="_blank" rel="noreferrer">Music Store: 119.5 × 46 × 8 cm interior listing ↗</a><a href="https://empireguitars.com/products/beast-nj-neck-through-b-c-rich-1" target="_blank" rel="noreferrer">Empire Guitars: NJ Beast example, 9 lb 4 oz, 25.5″ scale ↗</a><a href="https://www.guitarcenter.com/Used/BC-Rich/Used-BC-Rich-BEAST-NT-Black-Solid-Body-Electric-Guitar.gc" target="_blank" rel="noreferrer">Guitar Center: Beast NT reference silhouette ↗</a><a href="https://h-oproducts.com/product/1-2-polyether-polyurethane-foam/" target="_blank" rel="noreferrer">H-O Products: 1.2 pcf PU compression data ↗</a><a href="https://lamatek.com/data-sheets/closed-cell/nxl-series-1-7lb-non-xl-pe/" target="_blank" rel="noreferrer">LAMATEK: 1.75 pcf PE, 25% compression point ↗</a><a href="https://www.thefoamfactory.com/tech/polyethylene-foam-roll-Tech.html" target="_blank" rel="noreferrer">Foam Factory: 2 pcf PE, 25% / 50% points ↗</a><a href="https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/technical-bulletins/effective-packaging-transport-artwork.html" target="_blank" rel="noreferrer">Canadian Conservation Institute: cushioning method and strain guidance ↗</a></div></section>
    <footer>BEAST CASE / DROP LAB <span>Built for fit exploration. Verify with real measurements and drop testing.</span></footer>
  </main>`;

for(const group of ['impact','fit','foam','data']) $(`#${group}-fields`).innerHTML=controls.filter(c=>c.group===group).map(field).join('');
document.querySelector('.method-grid div:first-child p').innerHTML=document.querySelector('.method-grid div:first-child p').innerHTML.replace('a rigid 10 lb body','a rigid body at the entered weight (10 lb by default)');
document.querySelector('.presets').insertAdjacentHTML('afterend','<p class="micro-note">Default PE: 1.75 pcf, with its published 25% value. The 50% value is an estimate from a separate 2.0 pcf sheet. For 1.5 pcf PU, enter that grade’s compression data.</p>');
document.querySelector('.method-grid div:first-child').insertAdjacentHTML('beforeend','<p>Headstock-first drops include an assumed 0.25″ of the case’s existing end lining, using the soft PU curve as a stand-in. Change that thickness to match your case. Side, tail, head, base, and lid choices all use the same energy calculation; the landing choice sets the direction.</p>');
if(window.matchMedia('(max-width: 670px)').matches) document.querySelector('.controls details[open]').open=false;

function syncLanding(){
  const selected=activeLanding();
  document.querySelectorAll('[data-landing]').forEach(b=>{
    const on=b.dataset.landing===selected;
    b.classList.toggle('selected',on);
    b.setAttribute('aria-pressed',String(on));
  });
  $('#custom-angle').hidden=Boolean(selected);
}

function bind(){
  for(const c of controls){
    const number=$(`#${c.id}-number`),range=$(`#${c.id}-range`);
    const change=(source)=>{const n=Number(source.value); if(!Number.isFinite(n)) return; let value=Math.max(c.min,Math.min(c.max,n));if(c.id==='puBottom'||c.id==='puTop')value=Math.round(value*4)/4;state[c.id]=value;number.value=value;range.value=value;render();};
    number.addEventListener('change',()=>change(number));
    range.addEventListener('input',()=>change(range));
  }
  document.querySelectorAll('[data-landing]').forEach(b=>b.addEventListener('click',()=>{
    const chosen=LANDINGS.find(x=>x.id===b.dataset.landing);
    Object.assign(state,{face:chosen.face,tilt:chosen.tilt,azimuth:chosen.azimuth});
    for(const id of ['tilt','azimuth']){$(`#${id}-number`).value=state[id];$(`#${id}-range`).value=state[id];}
    render();
  }));
  $('#reset').addEventListener('click',()=>{Object.assign(state,defaults);for(const c of controls){$(`#${c.id}-number`).value=state[c.id];$(`#${c.id}-range`).value=state[c.id];}render();});
  $('#preset-pu').addEventListener('click',()=>{for(const [k,v] of Object.entries({pu25:.45,pu50:.65,pu70:1.1})){state[k]=v;$(`#${k}-number`).value=v;$(`#${k}-range`).value=v;}render();});
  $('#preset-pe').addEventListener('click',()=>{for(const [k,v] of Object.entries({pe25:5,pe50:14})){state[k]=v;$(`#${k}-number`).value=v;$(`#${k}-range`).value=v;}render();});
  document.querySelectorAll('.help-trigger').forEach(b=>b.addEventListener('click',event=>{
    event.stopPropagation();
    const open=b.getAttribute('aria-expanded')==='true';
    document.querySelectorAll('.help-trigger').forEach(x=>x.setAttribute('aria-expanded','false'));
    b.setAttribute('aria-expanded',String(!open));
  }));
  document.addEventListener('click',event=>{if(!event.target.closest('.help-wrap'))document.querySelectorAll('.help-trigger[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false'));});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.help-trigger[aria-expanded="true"]').forEach(x=>{x.setAttribute('aria-expanded','false');x.blur();});});
}

const fmt=(n,d=1)=>Number(n).toFixed(d);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleAngle=a=>a<22.5||a>=337.5?'HEADSTOCK END':a<67.5?'UPPER RIGHT':a<112.5?'RIGHT SIDE':a<157.5?'LOWER RIGHT':a<202.5?'TAIL END':a<247.5?'LOWER LEFT':a<292.5?'LEFT SIDE':'UPPER LEFT';
const color=t=>{const x=Math.max(0,Math.min(1,t));return `hsl(${lerp(187,7,x)} ${lerp(82,92,x)}% ${lerp(60,55,x)}%)`;};
function lerp(a,b,t){return a+(b-a)*t;}

function render(){
  const r=simulate(state),p=r.params;
  syncLanding();
  $('#metric-g').textContent=`${r.hardStop?'≥ ':''}${fmt(r.g,1)} g`;
  $('#metric-force').textContent=`${r.hardStop?'≥ ':''}${Math.round(r.force)} lbf`;
  $('#metric-zone').textContent=r.hardStop?(r.hardZones[0]||'HARD STOP'):(r.zones[0]?.zone||'—');
  $('#metric-zone-detail').textContent=r.hardStop?'First foam contact to fully compress':r.zones[0]?`${Math.round(r.zones[0].force)} lbf · ${fmt(r.zones[0].peakPressure,1)} psi peak`:'No contact';
  $('#vector-label').textContent=p.tilt===0?`${p.face==='base'?'BASE':'LID'} DOWN`:p.tilt===90?`${titleAngle(p.azimuth)} DOWN`:`${p.face==='base'?'BASE':'LID'} + ${titleAngle(p.azimuth)}`;
  $('#vector-detail').textContent=p.tilt===0?'Broad face lands flat':`${p.tilt}° tilt · ${p.azimuth}° edge direction`;
  $('#energy').textContent=`${Math.round(r.energy)} lb·in (${fmt(r.energy*.113,1)} J)`;
  $('#travel').textContent=`${fmt(r.travel,2)} in`;
  $('#pu-compression').textContent=r.puMax?`${fmt(r.puMax*100,0)}% · ${fmt(r.puMax*(p.face==='base'?p.puBottom:p.puTop),2)} in`:'—';
  $('#pe-compression').textContent=r.peMax?`${fmt(r.peMax*100,0)}% · local web`:'No side contact';
  $('#end-compression').textContent=r.endMax?`${fmt(r.endMax*100,0)}% · ${fmt(r.endMax*p.endLiner,2)} in`:'No end contact';
  $('#pressure').textContent=`${fmt(r.peakPressure,1)} psi`;
  $('#top-thick').textContent=`${fmt(p.puTop,2)}″`;
  $('#bottom-thick').textContent=`${fmt(p.puBottom,2)}″`;
  $('#pe-thick').textContent=`${fmt(p.peHeight,2)}″`;
  $('#body-thick').textContent=`${fmt(p.bodyThickness,2)}″`;
  $('#stack-note').textContent=(r.closure>0?`Closed-case nominal squeeze: ${fmt(r.closure,2)}″ across the two PU layers, before raised hardware. Check latch pressure and bridge clearance.`:`Nominal body clearance: ${fmt(r.fitClearance,2)}″, before raised hardware and the existing lining.`)+(p.tilt===90&&p.azimuth===0?` Head-first impact also uses ${fmt(p.endLiner,2)}″ assumed end lining.`:'');
  const flags=[];
  if(p.bodyWidth>p.caseWidth||p.guitarLength>p.caseLength)flags.push('The current guitar outline exceeds the case interior.');
  if(r.extrapolated)flags.push('Some foam exceeds published compression points; the force estimate uses extrapolation.');
  if(r.hardStop)flags.push(`Hard stop${r.hardZones.length?` at ${r.hardZones.join(', ')}`:''}: foam absorbed only ${Math.round(r.absorbed)} of ${Math.round(r.energy)} lb·in before full compression. Actual peak force and g are higher than shown.`);
  else if(r.bottomed)flags.push('At least one contact is near full foam compression.');
  if(!flags.length)flags.push('Within the entered fit and material range; verify with actual foam and case measurements.');
  $('#model-flag').className='model-flag '+(r.hardStop||r.bottomed?'danger':r.extrapolated?'caution':'ok');
  $('#model-flag').textContent=flags.join(' ');

  const maxZone=Math.max(1,...r.zones.map(z=>z.force));
  $('#zones').innerHTML=r.zones.slice(0,5).map((z,i)=>`<div class="zone-row"><span class="zone-index">0${i+1}</span><div><div class="zone-label"><span>${safe(z.zone)}</span><b>${Math.round(z.force)} lbf</b></div><div class="zone-track"><i style="width:${Math.max(3,z.force/maxZone*100)}%;background:${color(z.maxStrain/.8)}"></i></div><small>${fmt(z.maxCompression,2)}″ max crush · ${fmt(z.peakPressure,1)} psi</small></div></div>`).join('')||'<p class="micro-note">No contact at this orientation.</p>';

  const caseX=300-p.caseWidth/(p.bodyWidth/210)/2;
  const caseY=298.5-p.caseLength/(p.guitarLength/543)/2;
  const caseW=p.caseWidth/(p.bodyWidth/210),caseH=p.caseLength/(p.guitarLength/543);
  const bodyPath=shapePath(BODY),headPath=shapePath(HEAD);
  const heat=r.active.filter(v=>v.force>.2).sort((a,b)=>a.pressure-b.pressure).map(v=>{
    const t=Math.min(1,v.strain/(v.curve==='pu'?.85:.65));
    const radius=v.kind==='edge'?Math.max(2.5,Math.min(7,2+v.pressure/5)):Math.max(2.4,Math.min(5,2+v.pressure/4));
    return `<circle class="hotspot" cx="${v.px}" cy="${v.py}" r="${radius}" fill="${color(t)}" fill-opacity="${.40+.50*t}" stroke="${color(t)}" stroke-width=".7" data-id="${v.id}" tabindex="0" aria-label="${safe(v.zone)}, ${fmt(v.pressure,1)} psi, ${fmt(v.compression,2)} inches compression"/>`;
  }).join('');
  const hatch=Array.from({length:20},(_,i)=>`<line x1="${caseX+i*14-120}" y1="${caseY}" x2="${caseX+i*14+caseH-120}" y2="${caseY+caseH}"/>`).join('');
  $('#map').innerHTML=`<defs><pattern id="foam-pattern" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#728174" opacity=".34"/></pattern><clipPath id="case-clip"><rect x="${caseX+3}" y="${caseY+3}" width="${caseW-6}" height="${caseH-6}" rx="5"/></clipPath><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="none" stroke="#e8ad63" stroke-width="1.3"/></marker></defs>
    <rect x="${caseX-3}" y="${caseY-3}" width="${caseW+6}" height="${caseH+6}" rx="8" fill="#0e1519" stroke="#9c815f" stroke-width="4"/>
    <rect x="${caseX+2}" y="${caseY+2}" width="${caseW-4}" height="${caseH-4}" rx="5" fill="#25312e" stroke="#536a60" stroke-width="2"/>
    <g clip-path="url(#case-clip)"><rect x="${caseX}" y="${caseY}" width="${caseW}" height="${caseH}" fill="url(#foam-pattern)"/><g stroke="#50635a" stroke-width=".5" opacity=".23">${hatch}</g></g>
    <path d="${bodyPath}" fill="#6f8c79" fill-opacity=".37" stroke="#93b296" stroke-width="7" stroke-linejoin="round" opacity=".7"/>
    <path d="${bodyPath}" fill="#111b1b" stroke="#c2d1bd" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M307 154 L335 154 L335 387 L307 387 Z" fill="#172323" stroke="#93a599" stroke-width="1"/>
    <path d="${headPath}" fill="#111b1b" stroke="#c2d1bd" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M311 160 L311 390 M318 160 L318 390 M326 160 L326 390 M332 160 L332 390" stroke="#899b8d" stroke-width=".35" opacity=".7"/>
    ${Array.from({length:17},(_,i)=>`<line x1="308" x2="334" y1="${175+i*12}" y2="${175+i*12}" stroke="#b8c4b2" stroke-width="${i%4===0?1:.55}"/>`).join('')}
    <rect x="306" y="422" width="31" height="15" rx="1" fill="#2b3434" stroke="#a7aaa2" stroke-width="1"/><rect x="305" y="446" width="34" height="17" rx="1" fill="#2b3434" stroke="#a7aaa2" stroke-width="1"/><rect x="304" y="469" width="36" height="22" rx="2" fill="#3b4441" stroke="#c0bfb1" stroke-width="1"/>
    <circle cx="369" cy="473" r="2" fill="#c4c8b6"/><circle cx="375" cy="484" r="2" fill="#c4c8b6"/>
    <g class="heat-layer">${heat}</g>
    <g transform="rotate(${p.azimuth} 300 298)" opacity="${p.tilt===0?.25:1}"><path d="M300 272 L300 220" stroke="#e8ad63" stroke-width="2" marker-end="url(#arrow)"/><circle cx="300" cy="281" r="3" fill="#e8ad63"/></g>
    <text x="${caseX+8}" y="${caseY+18}" class="case-label">HEAD / 0°</text><text x="${caseX+8}" y="${caseY+caseH-9}" class="case-label">TAIL / 180°</text>`;
  $('#map').querySelectorAll('.hotspot').forEach(el=>{
    const v=r.active.find(x=>x.id===el.dataset.id);
    if(!v)return;
    const show=()=>{const box=el.getBoundingClientRect(),parent=$('.visual').getBoundingClientRect();const tip=$('#tooltip');tip.hidden=false;tip.innerHTML=`<b>${safe(v.zone)}</b><span>${fmt(v.pressure,1)} psi · ${fmt(v.force,1)} lbf at contact<br>${fmt(v.compression,2)}″ / ${fmt(v.strain*100,0)}% compression<br>${safe(v.layer)}${v.kind==='edge'?` · ${fmt(v.web,2)}″ foam web`:''}</span>`;tip.style.left=`${Math.min(parent.width-188,Math.max(8,box.left-parent.left+15))}px`;tip.style.top=`${Math.max(56,box.top-parent.top-68)}px`;};
    el.addEventListener('mouseenter',show);el.addEventListener('focus',show);
    el.addEventListener('mouseleave',()=>$('#tooltip').hidden=true);el.addEventListener('blur',()=>$('#tooltip').hidden=true);
  });
}

bind();render();
