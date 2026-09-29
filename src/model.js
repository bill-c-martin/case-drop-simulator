export const BODY = [
  [276,313],[264,350],[245,407],[259,399],[269,404],[278,420],
  [276,435],[265,452],[241,486],[214,523],[195,572],[216,552],
  [247,540],[274,534],[290,533],[290,520],[341,520],[357,538],
  [367,569],[384,542],[405,497],[383,463],[374,444],[375,432],
  [384,424],[398,425],[376,340],[379,375],[375,397],[364,408],
  [352,413],[340,412],[334,404],[334,386],[307,386],[294,386],
  [282,378],[275,364]
];

export const HEAD = [
  [304,27],[286,61],[286,80],[295,92],[288,125],[307,136],
  [307,155],[335,155],[335,136],[355,125],[347,92],[356,80],
  [355,61],[336,27],[339,52],[334,65],[322,72],[309,66],[301,52]
];

export const LANDINGS = [
  {id:'base',label:'BASE DOWN',face:'base',tilt:0,azimuth:90},
  {id:'lid',label:'LID DOWN',face:'lid',tilt:0,azimuth:90},
  {id:'left',label:'LEFT SIDE',face:'base',tilt:90,azimuth:270},
  {id:'right',label:'RIGHT SIDE',face:'base',tilt:90,azimuth:90},
  {id:'head',label:'HEAD DOWN',face:'base',tilt:90,azimuth:0},
  {id:'tail',label:'FEET DOWN',face:'base',tilt:90,azimuth:180}
];

export const defaults = {
  drop: 18, tilt: 0, azimuth: 90, face: 'base',
  mass: 10, caseLength: 47.05, caseWidth: 18.11, caseDepth: 3.15,
  guitarLength: 44.5, bodyWidth: 17.2, bodyThickness: 1.75,
  puBottom: .75, puTop: .75, peHeight: 1.125, sideGap: .09, endLiner: .25, maxPeWeb: 3,
  pu25: .45, pu50: .65, pu70: 1.1, pe25: 7.5, pe50: 14,
  neckSupport: .5, hardwareRise: .25
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a+(b-a)*t;

function polygonArea(poly) {
  let sum = 0;
  for (let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    sum += a[0]*b[1]-b[0]*a[1];
  }
  return sum/2;
}

function inside(poly,x,y) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i], b=poly[j];
    if ((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
  }
  return hit;
}

function stress(strain, curve) {
  if(strain<=0) return 0;
  for(let i=1;i<curve.length;i++) {
    if(strain<=curve[i][0]) {
      const a=curve[i-1],b=curve[i];
      return lerp(a[1],b[1],(strain-a[0])/(b[0]-a[0]));
    }
  }
  const last=curve.at(-1), prev=curve.at(-2);
  return last[1]+(strain-last[0])*(last[1]-prev[1])/(last[0]-prev[0]);
}

function work(strain,curve) {
  if(strain<=0) return 0;
  let total=0;
  for(let i=1;i<curve.length;i++) {
    const a=curve[i-1], b=curve[i];
    const end=Math.min(strain,b[0]);
    if(end>a[0]) total += (stress(a[0],curve)+stress(end,curve))*(end-a[0])/2;
    if(strain<=b[0]) return total;
  }
  const last=curve.at(-1);
  return total+(stress(last[0],curve)+stress(strain,curve))*(strain-last[0])/2;
}

function curves(p) {
  return {
    pu:[[0,0],[.25,p.pu25],[.5,p.pu50],[.7,p.pu70],[.85,p.pu70*3.2],[.95,p.pu70*11]],
    pe:[[0,0],[.25,p.pe25],[.5,p.pe50],[.65,p.pe50*2.4],[.85,p.pe50*7]]
  };
}

function geometry(p) {
  const sx=p.bodyWidth/210, sy=p.guitarLength/543;
  const left=-p.caseWidth/2,right=p.caseWidth/2;
  const top=-p.caseLength/2,bottom=p.caseLength/2;
  const toX=x=>(x-300)*sx;
  const toY=y=>(y-298.5)*sy;
  const body=BODY.map(([x,y])=>[toX(x),toY(y)]);
  return {sx,sy,left,right,top,bottom,body,toX,toY};
}

function sideThickness(x,y,nx,ny,g) {
  const distances=[];
  if(nx>1e-4) distances.push((g.right-x)/nx);
  if(nx< -1e-4) distances.push((g.left-x)/nx);
  if(ny>1e-4) distances.push((g.bottom-y)/ny);
  if(ny< -1e-4) distances.push((g.top-y)/ny);
  return Math.max(.04,Math.min(...distances));
}

function makeElements(p) {
  const g=geometry(p), cells=[];
  const cos=Math.cos(p.tilt*Math.PI/180), sin=Math.sin(p.tilt*Math.PI/180);
  const az=p.azimuth*Math.PI/180;
  const ux=Math.sin(az), uy=-Math.cos(az);
  const faceThick=p.face==='base'?p.puBottom:p.puTop;
  const fitClearance=p.caseDepth-p.puBottom-p.puTop-p.bodyThickness;
  const closure=Math.max(0,-fitClearance);
  const facePreload=clamp(closure/2,0,faceThick*.6);
  const hardwarePreload=p.face==='lid'?clamp(facePreload+p.hardwareRise,0,faceThick*.7):facePreload;

  // The body face is sampled on an evenly spaced grid. The guitar cutout is open
  // underneath: these cells only see the soft PU layer, never the PE sheet.
  const step=9;
  for(let y=318;y<572;y+=step) for(let x=195;x<405;x+=step) {
    if(!inside(BODY,x,y)) continue;
    const bridge=x>300&&x<344&&y>442&&y<500;
    const pickup=x>302&&x<341&&y>417&&y<447;
    const hardware=p.face==='lid'&&(bridge||pickup);
    cells.push({id:`face-${x}-${y}`,zone:bridge?'Bridge':pickup?'Pickups':y<415?'Upper body':y>526?'Tail points':'Body face',
      layer:p.face==='base'?'Bottom PU':'Lid PU',kind:'face',x:g.toX(x),y:g.toY(y),px:x,py:y,
      area:step*step*g.sx*g.sy*(p.face==='base'?.78:hardware?.82:.56),thick:faceThick,
      projection:cos,preload:hardware?hardwarePreload:facePreload,gap:0,curve:'pu'});
  }

  // Narrow neck support and headstock lining are approximations because the
  // catalog gives no support locations or compression values.
  for(let y=180;y<385;y+=18) {
    const x=321;
    cells.push({id:`neck-${y}`,zone:'Neck support',layer:p.face==='base'?'Bottom PU':'Lid PU',kind:'face',x:g.toX(x),y:g.toY(y),px:x,py:y,
      area:18*18*g.sx*g.sy*(y>307?.65:.28)*p.neckSupport,thick:faceThick,
      projection:cos,preload:facePreload,gap:0,curve:'pu'});
  }
  for(let y=45;y<155;y+=20) {
    cells.push({id:`head-${y}`,zone:'Headstock',layer:p.face==='base'?'Bottom PU':'Lid PU',kind:'face',x:g.toX(321),y:g.toY(y),px:321,py:y,
      area:17*20*g.sx*g.sy*.16,thick:faceThick,projection:cos,preload:facePreload,gap:.08,curve:'pu'});
  }

  // The body cradle stops at the body. Headstock-first impacts are carried by
  // the case's existing end lining, whose thickness and material are uncertain.
  const headProjection=sin*Math.max(0,-uy);
  const headGap=Math.max(0,g.toY(27)-(g.top+p.endLiner));
  for(const x of [304,336]) {
    cells.push({id:`head-end-${x}`,zone:'Headstock tips',layer:'End lining',kind:'edge',x:g.toX(x),y:g.toY(27),px:x,py:27,
      area:.18,thick:p.endLiner,projection:headProjection,preload:0,gap:headGap,curve:'pu',web:p.endLiner});
  }

  const signed=polygonArea(g.body);
  for(let i=0;i<g.body.length;i++) {
    const a=g.body[i],b=g.body[(i+1)%g.body.length];
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    if(len<.01) continue;
    const nx=(signed>0?dy:-dy)/len, ny=(signed>0?-dx:dx)/len;
    const px=(BODY[i][0]+BODY[(i+1)%BODY.length][0])/2;
    const py=(BODY[i][1]+BODY[(i+1)%BODY.length][1])/2;
    const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
    const projection=sin*Math.max(0,nx*ux+ny*uy);
    const web=sideThickness(x,y,nx,ny,g);
    if(web>p.maxPeWeb) continue;
    const tip=py<390||py>535||px<230||px>390;
    const zone=py<390?'Upper horns':py>535?'Tail points':px<270?'Left wing':px>375?'Right wing':'Body edge';
    cells.push({id:`edge-${i}`,zone,layer:'PE cradle',kind:'edge',x,y,px,py,area:len*Math.min(p.peHeight,p.bodyThickness)*(tip?.38:.72),
      thick:web,projection,preload:0,gap:p.sideGap,curve:'pe',web});
  }
  return {cells,geometry:g,closure,fitClearance};
}

export function simulate(input={}) {
  const p={...defaults,...input};
  const {cells,geometry:g,closure,fitClearance}=makeElements(p);
  const c=curves(p);
  const energy=p.mass*p.drop;
  const stateAt=s=>{
    let absorbed=0,force=0;
    const values=[];
    for(const e of cells) {
      const curve=c[e.curve];
      const pre=Math.min(.97,e.preload/e.thick);
      const compressed=Math.max(0,e.preload+s*e.projection-e.gap);
      const strain=clamp(compressed/e.thick,0,1);
      const pressure=stress(strain,curve);
      const preWork=work(pre,curve);
      const added=Math.max(0,e.area*e.thick*(work(strain,curve)-preWork));
      const localForce=e.area*pressure;
      absorbed+=added;
      force+=localForce*e.projection;
      values.push({...e,strain,compression:Math.min(compressed,e.thick),pressure,force:localForce,energy:added,
        limit:e.curve==='pu'?.7:.5,extrapolated:strain>(e.curve==='pu'?.7:e.curve==='pe'?.5:1)});
    }
    return {absorbed,force,values};
  };
  const hardDistance=Math.min(...cells.filter(e=>e.projection>1e-5).map(e=>Math.max(0,(e.thick+e.gap-e.preload)/e.projection)));
  const capacity=stateAt(hardDistance).absorbed;
  const hardStop=capacity<energy-.001;
  let lo=0,hi=hardDistance;
  for(let i=0;i<55;i++) {
    const mid=(lo+hi)/2;
    if(stateAt(mid).absorbed<energy) lo=mid; else hi=mid;
  }
  const travel=hardStop?hardDistance:(lo+hi)/2;
  const state=stateAt(travel);
  const active=state.values.filter(v=>v.force>.03&&v.projection>.001);
  const zones={};
  for(const v of active) {
    if(!zones[v.zone]) zones[v.zone]={zone:v.zone,force:0,peakPressure:0,maxCompression:0,maxStrain:0,energy:0,layer:v.layer};
    const z=zones[v.zone];
    z.force+=v.force*v.projection;
    z.peakPressure=Math.max(z.peakPressure,v.pressure);
    z.maxCompression=Math.max(z.maxCompression,v.compression);
    z.maxStrain=Math.max(z.maxStrain,v.strain);
    z.energy+=v.energy;
  }
  const ranked=Object.values(zones).sort((a,b)=>b.force-a.force);
  const maxStrain=Math.max(0,...active.map(v=>v.strain));
  const peakPressure=Math.max(0,...active.map(v=>v.pressure));
  const over=active.filter(v=>v.extrapolated);
  const hardZones=[...new Set(active.filter(v=>v.strain>=.999).map(v=>v.zone))];
  return {params:p,geometry:g,closure,fitClearance,travel,energy,absorbed:state.absorbed,hardStop,unabsorbed:Math.max(0,energy-state.absorbed),
    force:state.force,g:state.force/p.mass,peakPressure,maxStrain,hardZones,
    active,values:state.values,zones:ranked,extrapolated:over.length>0,
    bottomed:active.some(v=>v.strain>=.95),
    puMax:Math.max(0,...active.filter(v=>v.layer==='Bottom PU'||v.layer==='Lid PU').map(v=>v.strain)),
    endMax:Math.max(0,...active.filter(v=>v.layer==='End lining').map(v=>v.strain)),
    peMax:Math.max(0,...active.filter(v=>v.curve==='pe').map(v=>v.strain))};
}

export const shapePath=poly=>'M '+poly.map(([x,y])=>`${x} ${y}`).join(' L ')+' Z';
