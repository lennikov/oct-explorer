/* @repo-annotation: 08-export-workflows.js
 * PNG and video export workflows, including calibrated overlays, linked fundus views and cancellation.
 * The build script strips this note; the canonical recovered HTML remains byte-exact.
 */
let videoJob=null;
const exportOptions=()=>({scale:$('exportScale').checked,measure:$('exportMeasurements').checked,legend:$('exportLegend').checked,lesions:$('exportLesions').checked});
function videoMime(){
 if(typeof VideoEncoder!=='undefined')return 'video/webm';if(typeof MediaRecorder==='undefined')return null;
 return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||null;
}
function openExport(kind='image'){
 if(!S.volume||S.busy)return;
 if(playing)$('play').click();
 $('exportType').value=kind==='video'?'rotation':'bscan';$('exportError').hidden=true;
 $('exportScale').checked=$('showScale').checked;
 updateExportOptions();$('exportDialog').showModal();
}
function updateExportOptions(){
 const type=$('exportType').value,video=['rotation','sweep'].includes(type),hasFundus=S.sources.some(s=>s.fundus),mime=videoMime();
 $('exportType').querySelector('[value="paired"]').disabled=!hasFundus;
 $('videoOptions').hidden=!video;$('sectionExportOptions').hidden=type==='rotation';
 $('videoFundus').disabled=!hasFundus||type!=='sweep';
 $('exportMeasurements').closest('label').hidden=video;
 const hints={bscan:'Save the current section, including its color map and slice position.',paired:'Pair the current section with its source fundus and the teal slice trace.',rotation:'Record one complete 360° orbit from your current camera angle and zoom.',sweep:'Sweep across the loaded scan range with the volume and native X–Z B-scan. Your current view is restored afterward.'};
 $('exportHint').textContent=hints[type];
 const {u,v,pw,ph}=basis(),known=planePhysicalLength(u,pw)>0||planePhysicalLength(v,ph)>0;
 $('exportScaleNote').textContent=known?'Bars use the known axis spacing. Original burned-in marks remain in the image.':'No physical scale is known for this section. Enter spacing or detect a scale marker to add calibrated bars; exported images will say uncalibrated.';
 $('videoNote').textContent=mime?`WebM video · no audio · ${S.stereo?'red–cyan stereo enabled':'current 3D rendering'}. Chrome encodes complete frames where supported; generation time depends on rendering speed. Keep this tab visible. Recorder fallback reports its actual captured frame rate${!gpu||gpu.unavailable?'; CPU volume rendering uses a lower resolution':''}.`:'Video recording is unavailable in this browser. Open the app in Chrome to record canvas video.';
 $('startExport').textContent=video?'Create video':'Save PNG';$('startExport').disabled=video&&!mime;
}
function exportName(suffix){return (S.label||'OCT').replace(/[^a-z0-9._-]+/gi,'_').slice(0,60)+'_'+suffix}
function fitText(c,text,x,y,max){let str=String(text);while(str.length&&c.measureText(str).width>max)str=str.slice(0,-1);c.fillText(str.length<text.length?str.slice(0,-1)+'…':str,x,y)}
function contain(c,source,x,y,w,h){const scale=Math.min(w/source.width,h/source.height),dw=source.width*scale,dh=source.height*scale;c.drawImage(source,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function calibrationCaption(){return S.calibrated?'Calibrated X / Y / Z (µm)':S.xzCalibrated?'X/Z calibrated · Y spacing unknown':'Uncalibrated · scan axis expanded'}
function sectionCaption(){return `Scan ${displayedScan(S.center[1]).toFixed(2)} / ${S.total} · yaw ${S.yaw}° · tilt ${S.tilt}° · ${S.interp?'interpolated':'nearest sample'}`}
async function exportFundus(cache,includeLesions=true){
 const nearest=nearestSource(),source=nearest?.fundus?nearest:S.sources.find(s=>s.fundus);
 if(!source)return null;
 if(cache.source!==source){cache.bitmap?.close();cache.bitmap=null;cache.source=source;cache.bitmap=await createImageBitmap(source.fundus.blob)}
 const canvas=document.createElement('canvas');canvas.width=source.fundus.w;canvas.height=source.fundus.h;
 const c=canvas.getContext('2d');c.drawImage(cache.bitmap,0,0);drawFundusTrace(c,false);if(includeLesions)drawLesionFundus(c);
 return {canvas,reference:source!==nearest,source};
}
function freezeExport(){const surfaces=[document.querySelector('header'),document.querySelector('main'),document.querySelector('footer')],previous=surfaces.map(s=>s.inert);surfaces.forEach(s=>s.inert=true);return ()=>surfaces.forEach((s,i)=>s.inert=previous[i])}
async function exportImage(){
 const type=$('exportType').value,options=exportOptions(),cache={},unfreeze=freezeExport();
 $('exportDialog').close();busy(true,'Preparing PNG…');
 try{
  const slice=document.createElement('canvas');renderSlice(slice,options);
  const fundus=type==='paired'?await exportFundus(cache,options.lesions):null;
  if(type==='paired'&&!fundus)throw Error('No source fundus is available for this volume.');
  const pad=20,gap=20,top=94,foot=options.legend?102:70;
  const cv=document.createElement('canvas');cv.width=slice.width+pad*2+(fundus?fundus.canvas.width+gap:0);cv.height=top+Math.max(slice.height,fundus?.canvas.height||0)+foot;
  const c=cv.getContext('2d');c.fillStyle='#07111b';c.fillRect(0,0,cv.width,cv.height);
  c.fillStyle='#eef7fb';c.font='17px system-ui';fitText(c,S.label,pad,29,cv.width-pad*2);
  c.fillStyle='#afc7d6';c.font='12px system-ui';fitText(c,sectionCaption(),pad,52,cv.width-pad*2);
  let x=pad;const imageH=cv.height-top-foot;
  if(fundus){c.fillStyle='#75e5cb';c.fillText(fundus.reference?'Reference fundus · teal slice trace':'Source fundus · teal slice trace',x,top-12);c.drawImage(fundus.canvas,x,top+(imageH-fundus.canvas.height)/2);x+=fundus.canvas.width+gap}
  c.fillStyle='#b6cdd9';c.fillText($('sliceTitle').textContent,x,top-12);c.drawImage(slice,x,top+(imageH-slice.height)/2);
  const y=top+imageH;c.font='12px system-ui';c.fillStyle='#d6e7ee';fitText(c,calibrationCaption(),pad,y+26,cv.width-pad*2);
  c.fillStyle='#8ca6b9';c.font='11px system-ui';fitText(c,`Nearest acquired: ${nearestSource().name}`,pad,y+47,cv.width-pad*2);
  if(options.legend)drawIntensityLegend(c,pad,y+65,Math.min(440,cv.width-pad*2));
  const blob=await new Promise(resolve=>cv.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not encode PNG.');
  downloadBlob(blob,exportName(`scan_${displayedScan(S.center[1]).toFixed(2)}${fundus?'_fundus':''}.png`));
  status('PNG exported with the current intensity display and annotations.');
 }catch(e){err(e)}finally{cache.bitmap?.close();busy(false);unfreeze()}
}
function videoLayout(w,h,type,fundus){
 const top=55,bottom=h-49,height=bottom-top;
 if(type==='rotation')return {volume:{x:16,y:top,w:w-32,h:height}};
 const right=Math.round(w*.5)+8,width=w-right-16;
 return {volume:{x:16,y:top,w:right-32,h:height},slice:{x:right,y:top+18,w:width,h:fundus?height*.48-18:height-18},fundus:fundus?{x:right,y:top+height*.51+17,w:width,h:height*.49-17}:null};
}
async function paintVideoFrame(canvas,type,p,snapshot,options,cache,layout){
 if(type==='rotation')S.camYaw=snapshot.camYaw+Math.PI*2*p;
 else{S.center=[.5,p,.5];S.yaw=S.tilt=0;S.plane=true;S.points=[]}
 render3D(options.lesions!==false);
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.fillStyle='#07111b';c.fillRect(0,0,w,h);
 c.font='15px system-ui';c.fillStyle='#e7f2f9';fitText(c,S.label,16,23,w-32);
 c.font='11px system-ui';c.fillStyle='#89aabd';c.fillText(type==='rotation'?`360° volume rotation · ${Math.round(p*360)}°${S.stereo?' · red–cyan stereo':''}`:sectionCaption(),16,42);
 const r=layout.volume;c.drawImage(C.volume,r.x,r.y,r.w,r.h);c.drawImage(C.overlay,r.x,r.y,r.w,r.h);
 if(layout.slice){
  const slice=document.createElement('canvas');renderSlice(slice,{...options,measure:false});const r=layout.slice;
  c.fillStyle='#adc4d1';c.fillText('B-scan · X–Z'+(S.stereo?' · 3D panel in red–cyan':''),r.x,r.y-5);contain(c,slice,r.x,r.y,r.w,r.h);
 }
 if(layout.fundus){const f=await exportFundus(cache,options.lesions),r=layout.fundus;if(f){c.fillStyle='#75e5cb';c.fillText(f.reference?'Reference fundus · slice trace':'Source fundus · slice trace',r.x,r.y-5);contain(c,f.canvas,r.x,r.y,r.w,r.h)}}
 c.font='10px system-ui';c.fillStyle='#a0bacb';fitText(c,calibrationCaption(),16,h-17,type==='sweep'&&options.legend?w-325:w-32);
 if(type==='sweep'&&options.legend)drawIntensityLegend(c,w-292,h-35,275);
}
async function recordVideo(){
 const mime=videoMime();if(!mime||S.busy)return;
 const type=$('exportType').value,options=exportOptions(),seconds=Number($('videoDuration').value),fps=Number($('videoFps').value),width=Number($('videoSize').value);
 const snapshot={center:[...S.center],yaw:S.yaw,tilt:S.tilt,camYaw:S.camYaw,camPitch:S.camPitch,zoom:S.zoom,points:S.points,plane:S.plane};
 const cv=document.createElement('canvas');cv.width=width;cv.height=width*9/16;
 const layout=videoLayout(cv.width,cv.height,type,type==='sweep'&&$('videoFundus').checked&&S.sources.some(s=>s.fundus));
 const cache={},job={cancelled:false};videoJob=job;S.exporting=true;
 const unfreeze=freezeExport();$('exportDialog').close();busy(true,'Preparing video…');$('cancelExport').hidden=false;$('exportProgress').hidden=false;$('exportProgress').value=0;
 let outcome='Video export cancelled; view restored.';
 try{
  for(const target of [C.volume,C.overlay]){target.width=Math.round(layout.volume.w);target.height=Math.round(layout.volume.h)}
  const config=await encoderConfig(cv.width,cv.height,fps);
  const paint=p=>paintVideoFrame(cv,type,p,snapshot,options,cache,layout);
  const result=config?{blob:await encodeVideo(cv,config,seconds,job,paint),fps}:await recordCanvasFrames(cv,mime,seconds,fps,job,paint);
  if(result?.blob&&!job.cancelled){downloadBlob(result.blob,exportName(`${type}${S.stereo?'_red-cyan':''}.webm`));outcome=`${type==='rotation'?'Rotation':'Slice sweep'} video exported · ${seconds}s, ${Number(result.fps.toFixed(2))} fps; view restored.`}
 }catch(e){outcome='Video export failed; view restored.';err(e)}finally{
  cache.bitmap?.close();
  Object.assign(S,snapshot);S.exporting=false;videoJob=null;busy(false);unfreeze();$('cancelExport').hidden=true;$('exportProgress').hidden=true;
  showSize();syncControls();refresh();status(outcome,outcome.includes('failed'));
 }
}
$('palette').onchange=()=>{S.palette=$('palette').value;updateHeatmap();refresh()};
$('colorStrength').oninput=()=>{S.colorStrength=Number($('colorStrength').value)/100;updateHeatmap();refresh()};
$('exportType').onchange=updateExportOptions;
$('closeExport').onclick=()=>$('exportDialog').close();
$('startExport').onclick=()=>['rotation','sweep'].includes($('exportType').value)?recordVideo():exportImage();
$('cancelExport').onclick=()=>{if(videoJob){videoJob.cancelled=true;$('loadingText').textContent='Cancelling video…'}};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&videoJob){e.preventDefault();videoJob.cancelled=true}});
updateHeatmap();
