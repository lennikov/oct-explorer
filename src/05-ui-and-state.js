/* @repo-annotation: 05-ui-and-state.js
 * Browser UI state, transport helpers, numeric image sampling and surface dimensions.
 * The build script strips this note; the canonical recovered HTML remains byte-exact.
 */
'use strict';
const APP_HTML='<!doctype html>\n'+document.documentElement.outerHTML;
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const S={sources:[],preview:null,volume:null,w:0,n:0,d:0,crop:null,calibrated:false,ext:[1,.65,1],center:[.5,.5,.5],yaw:0,tilt:0,camYaw:-.62,camPitch:.38,zoom:2.1,lo:20,hi:210,gamma:1,opacity:1.2,mode:0,plane:true,interp:true,measure:false,points:[],busy:false,job:0,label:'',sourceLabel:'',frame:0,total:0,sourceIndices:[],nav:'fundus',stereo:false,separation:.04,swapEyes:false,scaleDetection:null,scaleApplied:false,xzCalibrated:false,palette:'gray',colorStrength:1,exporting:false};
const C={slice:$('slice'),enface:$('enface'),volume:$('volume'),overlay:$('overlay'),crop:$('cropCanvas')};
const ctx=C.slice.getContext('2d'),ectx=C.enface.getContext('2d'),octx=C.overlay.getContext('2d');
let gpu=null, queued=false,drag=null,playing=false,raf=0;
function status(msg,error=false){$('status').textContent=msg;$('status').classList.toggle('error',error)}
function busy(v,msg){S.busy=v;$('loading').hidden=!v;if(msg){$('loadingText').textContent=msg;status(msg)}document.querySelectorAll('[data-load]').forEach(b=>b.disabled=v)}
const pause=()=>new Promise(r=>setTimeout(r,0));
function err(e){console.error(e);status(e.message||String(e),true);$('noticeText').textContent=e.message||String(e);$('notice').hidden=false}
function showSize(){if(S.exporting)return;const r=$('volumePane').getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,1.5);for(const c of [C.volume,C.overlay]){c.width=Math.max(1,Math.floor(r.width*ratio));c.height=Math.max(1,Math.floor(r.height*ratio))}render3D()}
function numericName(a,b){return a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'})}
