import test from 'node:test';
import assert from 'node:assert/strict';
import {LANDINGS,simulate} from './model.js';

test('conserves drop energy while the foam has travel',()=>{
  const result=simulate({drop:6,tilt:30,azimuth:90});
  assert.equal(result.hardStop,false);
  assert.ok(Math.abs(result.absorbed-result.energy)<1e-7);
  assert.ok(result.force>0);
});

test('flat base impact uses the bottom PU while side PE stays unloaded',()=>{
  const result=simulate({drop:6,tilt:0,face:'base'});
  assert.ok(result.active.some(v=>v.layer==='Bottom PU'));
  assert.ok(result.active.every(v=>v.layer!=='PE cradle'));
});

test('side impact loads the PE cradle and changes contact zone with azimuth',()=>{
  const right=simulate({drop:6,tilt:90,azimuth:90});
  const left=simulate({drop:6,tilt:90,azimuth:270});
  assert.ok(right.active.some(v=>v.layer==='PE cradle'));
  assert.ok(right.active.every(v=>v.layer!=='Bottom PU'));
  assert.notEqual(right.zones[0].zone,left.zones[0].zone);
});

test('an unabsorbable drop reports remaining energy and a lower bound on force',()=>{
  const result=simulate({drop:60,tilt:0});
  assert.equal(result.hardStop,true);
  assert.ok(result.unabsorbed>0);
  assert.ok(result.absorbed<result.energy);
});

test('closed case preload reflects the three-layer body fit',()=>{
  const tight=simulate({caseDepth:3});
  const loose=simulate({caseDepth:4});
  assert.ok(tight.closure>0);
  assert.ok(loose.fitClearance>0);
});

test('each landing preset reaches its intended cushioning layer',()=>{
  const byId=Object.fromEntries(LANDINGS.map(p=>[p.id,simulate({...p,drop:6})]));
  assert.ok(byId.base.active.some(v=>v.layer==='Bottom PU'));
  assert.ok(byId.lid.active.some(v=>v.layer==='Lid PU'));
  for(const id of ['left','right','tail']) assert.ok(byId[id].active.some(v=>v.layer==='PE cradle'));
  assert.ok(byId.head.active.some(v=>v.layer==='End lining'));
  assert.ok(byId.head.hardStop);
});

test('the three allowed bottom PU thicknesses change compression and force',()=>{
  const thin=simulate({drop:6,tilt:0,puBottom:.5});
  const middle=simulate({drop:6,tilt:0,puBottom:.75});
  const thick=simulate({drop:6,tilt:0,puBottom:1});
  assert.ok(thin.g>middle.g&&middle.g>thick.g);
  assert.ok(thin.puMax>middle.puMax&&middle.puMax>thick.puMax);
});

test('lid PU thickness is independent from bottom PU thickness',()=>{
  const thin=simulate({face:'lid',tilt:0,drop:6,puTop:.5,puBottom:.75,hardwareRise:0,caseDepth:4});
  const thick=simulate({face:'lid',tilt:0,drop:6,puTop:1,puBottom:.75,hardwareRise:0,caseDepth:4});
  assert.ok(thin.g>thick.g);
  assert.ok(thin.puMax>thick.puMax);
  assert.ok(thin.active.every(v=>v.layer==='Lid PU'));
});
