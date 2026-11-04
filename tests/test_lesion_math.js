/* Isolated tests of original, pure OCT calculations; no browser/device access. */
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=path.join(__dirname,'../src/04-lesion-analysis.js');
const text=fs.readFileSync(src,'utf8');
const begin=text.indexOf('const LesionMath=(()=>{');
const end=text.indexOf('})();',begin);
assert(begin>=0&&end>begin,'Missing lesion math module');
const isolated=text.slice(begin,end+5)+'\n; this.math=LesionMath;';
const context={};
vm.runInNewContext(isolated,context,{timeout:3000});
const m=context.math;
const square=[[0,0],[2,0],[2,2],[0,2]];
assert.equal(m.area(square),4,'Square area');
assert.equal(m.polygonError(square,10,10),null,'Valid simple polygon');
assert.ok(m.polygonError([[0,0],[2,2],[0,2],[2,0]],10,10),'Reject crossed polygon');
const result=m.analyze([
 {frame:'a',ordinal:0,points:[],absent:true},
 {frame:'b',ordinal:1,points:square,absent:false},
 {frame:'c',ordinal:2,points:[],absent:true},
],[1,5,2],true,false);
assert.equal(result.volumeUm3,40,'Trapezoidal volume 2 sections of 20 um3');
assert.equal(result.bounded,true,'Boundary annotations');
const missing=m.analyze([{frame:'a',ordinal:0,points:square,absent:false},{frame:'b',ordinal:1,points:square,absent:false}], [1,null,2]);
assert.equal(missing.volumeUm3,null,'No volume without Y spacing');
console.log('OK: source ROI polygon and volume unit tests passed');
