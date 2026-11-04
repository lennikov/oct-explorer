/* @repo-annotation: 04-lesion-analysis.js
 * Source-coordinate ROI polygons, crossing checks, trapezoidal lesion-volume integration, annotation persistence and CSV export.
 * The build script strips this note; the canonical recovered HTML remains byte-exact.
 */
// Continuous polygon area in ORIGINAL source pixel coordinates. Volumes use
// trapezoidal integration between annotated scan centers, without extrapolation.
const LesionMath=(()=>{
 const eps=1e-8;
 function area(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1]}return Math.abs(a)/2}
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function onSegment(a,b,p){return Math.abs(cross(a,b,p))<eps&&p[0]>=Math.min(a[0],b[0])-eps&&p[0]<=Math.max(a[0],b[0])+eps&&p[1]>=Math.min(a[1],b[1])-eps&&p[1]<=Math.max(a[1],b[1])+eps}
 function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<-eps&&z*w<-eps||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b)}
 function polygonError(points,w,h){
  if(!Array.isArray(points)||points.length<3||points.length>512)return 'Use 3–512 vertices for a contour.';
  if(points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[1]<0||p[0]>w-1||p[1]>h-1))return 'Contour vertices must fit inside the original image.';
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length;if(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1])<1e-5)return 'Remove duplicate vertices.';for(let k=i+1;k<points.length;k++){const l=(k+1)%points.length;if(i===k||j===k||l===i)continue;if(intersects(points[i],points[j],points[k],points[l]))return 'The contour crosses or touches itself. Adjust the vertices.'}}
  if(area(points)<.01)return 'The contour must enclose a nonzero area.';
  return null;
 }
 function analyze(records,spacing,interpolate=true,ambiguous=false){
  const [sx,sy,sz]=spacing.map(v=>Number.isFinite(v)&&v>0?v:null),xz=sx!==null&&sz!==null;
  const rows=records.map(r=>({...r,areaPx2:r.absent?0:area(r.points),areaUm2:xz?(r.absent?0:area(r.points)*sx*sz):null,yUm:sy!==null?r.ordinal*sy:null})).sort((a,b)=>a.ordinal-b.ordinal);
  let volume=0,missing=0,maxGap=0,reason=null;
  if(!xz||sy===null)reason='Enter positive X, Y and Z spacing to calculate µm³.';
  if(rows.length<2)reason='Annotate at least two different scans, including absent boundaries where possible.';
  if(ambiguous)reason='Scan positions are ambiguous in this multi-page sequence. Export one image per scan or one multi-page TIFF.';
  for(let i=1;i<rows.length;i++){const delta=rows[i].ordinal-rows[i-1].ordinal;if(delta<=0){reason='Annotations have duplicate scan positions.';continue}missing+=Math.max(0,delta-1);maxGap=Math.max(maxGap,delta);if(xz&&sy!==null)volume+=(rows[i-1].areaUm2+rows[i].areaUm2)*.5*delta*sy}
  if(!Number.isFinite(volume)||rows.some(r=>r.areaUm2!==null&&!Number.isFinite(r.areaUm2)))reason='Physical dimensions exceed the numeric range; check calibration.';
  if(!interpolate&&missing)reason=`${missing} scan${missing===1?' has':'s have'} not been outlined or marked absent within the measured range.`;
  const bounded=rows.length>=2&&rows[0].absent&&rows.at(-1).absent;
  return {rows,volumeUm3:reason?null:volume,volumeMm3:reason?null:volume/1e9,reason,bounded,missing,maxGap,reviewed:rows.length,positive:rows.filter(r=>!r.absent).length,maxAreaUm2:xz&&rows.length?Math.max(0,...rows.map(r=>r.areaUm2)):null,spanUm:rows.length>1&&sy!==null?(rows.at(-1).ordinal-rows[0].ordinal)*sy:null};
 }
 return {area,polygonError,analyze};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LesionMath;

const L={projects:new Map(),indexMap:new Map(),project:null,frame:0,draft:null,edit:null,drag:null,background:null,initialized:false,colors:['#ffc16b','#ef92bf','#95b9ff','#74e0c6','#d0a2ff','#ff967f']};
const lesionFrameId=source=>source.name.replaceAll('\\','/').split('/').at(-1);
function lesionSource(){const g=catalog[activeVolume];return {files:g.entries.map(e=>[e.name.replaceAll('\\','/').split('/').at(-1),e.size]),width:S.sources[0].w,height:S.sources[0].h,scans:S.total,fingerprints:S.sources.map(s=>[lesionFrameId(s),s.sourceHash])}}
function lesionSelected(){return L.project?.lesions.find(l=>l.id===L.project.selected)||null}
function lesionRecord(lesion,frame=L.frame){return lesion?.sections[lesionFrameId(S.sources[frame])]||null}
function lesionAnalysis(lesion){const positions=S.sourceIndices;return LesionMath.analyze(Object.values(lesion.sections),axisCalibration(),L.project.interpolate,positions.some((p,i)=>i&&p<=positions[i-1]))}
function lesionMessage(text,error=false){$('lesionMessage').textContent=text;$('lesionMessage').classList.toggle('error',error)}
function lesionFormat(n,unit=''){return n===null||!Number.isFinite(n)?'—'+(unit?' '+unit:''):n.toLocaleString(undefined,{maximumSignificantDigits:5})+(unit?' '+unit:'')}
function lesionRemember(){L.project.undo.push(JSON.stringify({lesions:L.project.lesions,selected:L.project.selected,interpolate:L.project.interpolate,next:L.project.next}));if(L.project.undo.length>60)L.project.undo.shift()}
function lesionVolumeReady(ready){
 if(!L.initialized)return;
 L.draft=L.edit=L.drag=L.background=null;
 if(!ready){if($('lesionDialog').open)$('lesionDialog').close();L.project=null;return}
 const source=lesionSource(),key=catalog[activeVolume].key+'\u0001'+JSON.stringify(source);
 if(!L.projects.has(key))L.projects.set(key,{source,lesions:[],selected:null,next:1,interpolate:true,undo:[]});
 L.project=L.projects.get(key);L.indexMap=new Map(S.sources.map((s,i)=>[lesionFrameId(s),i]));lesionBadge();
}
function lesionBadge(){if(!$('lesionAnalysis'))return;const n=L.project?.lesions.filter(l=>Object.keys(l.sections).length).length||0;$('lesionAnalysis').textContent=n?`Lesions · ${n}`:'Lesions'}
function lesionCalibrationChanged(){if(!L.initialized||!L.project)return;L.background=null;if($('lesionDialog').open){lesionFillSpacing();lesionUpdate();lesionDrawEditor()}}
function lesionFillSpacing(){for(const [a,b]of [['lesionSx','sx'],['lesionSy','sy'],['lesionSz','sz']])$(a).value=$(b).value;const cal=axisCalibration();$('lesionCalibrationState').textContent=cal.every(v=>v!==null)?'X/Y/Z are set. Volume uses these physical spacings.':cal[0]&&cal[2]?'X/Z are set. Enter Y scan spacing to calculate µm³.':'Enter X/Z source pixel spacing and Y scan spacing for physical volume.';$('lesionCalibration').open=cal.some(v=>v===null)}
function lesionAdd(){if(!lesionCanLeave())return;lesionRemember();const n=L.project.next++,lesion={id:'lesion-'+n,name:'Lesion '+n,type:'Laser CNV',color:L.colors[(n-1)%L.colors.length],sections:{}};L.project.lesions.push(lesion);L.project.selected=lesion.id;lesionUpdate();lesionDrawEditor();$('lesionName').focus();lesionMessage('Click Outline lesion, then click around the boundary. Mark absent scans at each end when available.')}
function lesionOpen(){
 if(!S.volume||S.busy)return;if(playing)$('play').click();
 if(!L.project)lesionVolumeReady(true);L.frame=Math.round(S.center[1]*Math.max(0,S.n-1));L.draft=L.edit=L.drag=null;L.background=null;
 $('lesionDataset').textContent=S.label;$('lesionFrame').replaceChildren();
 S.sources.forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${S.sourceIndices[i]+1} / ${S.total} · ${lesionFrameId(s)}`;$('lesionFrame').append(o)});
 $('lesionZoom').value=100;$('lesionDialog').showModal();document.querySelector('.lesionSidebar').scrollTop=0;lesionFillSpacing();
 if(!L.project.lesions.length)lesionAdd();else{lesionUpdate();lesionDrawEditor()}
 lesionMessage('Outline the visible lesion on acquired B-scans. Drag saved contour vertices to edit.');
}
function lesionCanLeave(){if(L.draft){lesionMessage('Finish or discard the current draft before changing scan or lesion.',true);return false}return true}
function lesionSetFrame(index){if(!lesionCanLeave()){$('lesionFrame').value=L.frame;return}L.frame=clamp(index,0,S.n-1);L.background=null;S.center=[.5,L.frame/Math.max(1,S.n-1),.5];S.yaw=S.tilt=0;S.points=[];syncControls();lesionUpdate();lesionDrawEditor();refresh();lesionMessage(lesionRecord(lesionSelected())?.absent?'This scan is marked absent.':lesionRecord(lesionSelected())?'Saved contour · drag a vertex to adjust.':'No annotation on this scan. Outline it or mark the lesion absent.')}
function lesionSectionBase(){return {frame:lesionFrameId(S.sources[L.frame]),ordinal:S.sourceIndices[L.frame]}}
function lesionCommit(record){const lesion=lesionSelected();if(!lesion)return;lesionRemember();lesion.sections[record.frame]=record;L.draft=L.edit=L.drag=null;lesionUpdate();lesionDrawEditor();refresh()}
function lesionStart(){if(L.draft)return;L.draft={points:[],method:'drawn'};lesionUpdate();lesionDrawEditor();lesionMessage('Click vertices around the lesion. Click the first vertex or press Enter to close the contour.')}
function lesionFinish(){if(!L.draft)return;const points=L.draft.points,source=S.sources[L.frame],error=LesionMath.polygonError(points,source.w,source.h);if(error){lesionMessage(error,true);return}lesionCommit({...lesionSectionBase(),points:points.map(p=>[...p]),absent:false,method:L.draft.method});lesionMessage('Contour saved. Drag vertices to adjust it, or move to another scan.')}
function lesionDiscard(){L.draft=L.edit=L.drag=null;lesionUpdate();lesionDrawEditor();lesionMessage('Draft discarded; saved annotations retained.')}
function lesionPoint(e){const r=$('lesionCanvas').getBoundingClientRect();return [S.crop.x+clamp((e.clientX-r.left)/r.width,0,1)*(S.crop.w-1),S.crop.y+clamp((e.clientY-r.top)/r.height,0,1)*(S.crop.h-1)]}
function lesionHit(points,e){const r=$('lesionCanvas').getBoundingClientRect();let best=-1,d=9;points.forEach((p,i)=>{const x=r.left+(p[0]-S.crop.x)/(S.crop.w-1)*r.width,y=r.top+(p[1]-S.crop.y)/(S.crop.h-1)*r.height,q=Math.hypot(e.clientX-x,e.clientY-y);if(q<d){best=i;d=q}});return best}
function lesionDrawEditor(){
 if(!$('lesionDialog').open||!S.volume||!L.project)return;
 const source=S.sources[L.frame],cv=$('lesionCanvas'),crop=S.crop,cal=axisCalibration(),aspect=cal[0]&&cal[2]?(crop.w-1)*cal[0]/((crop.h-1)*cal[2]):(crop.w-1)/(crop.h-1),max=1100,w=Math.max(2,Math.round(max*aspect/Math.max(1,aspect))),h=Math.max(2,Math.round(max/Math.max(1,aspect)));
 const key=[lesionFrameId(source),JSON.stringify(crop),S.lo,S.hi,S.gamma,S.palette,S.colorStrength,w,h].join('|');
 if(L.background?.key!==key){const image=document.createElement('canvas');image.width=w;image.height=h;const c=image.getContext('2d'),im=c.createImageData(w,h),colors=slicePalette();for(let y=0;y<h;y++){const sy=crop.y+Math.round(y*(crop.h-1)/(h-1));for(let x=0;x<w;x++){const sx=crop.x+Math.round(x*(crop.w-1)/(w-1)),v=lut(source.gray[sx+sy*source.w]),i=(x+y*w)*4;im.data[i]=colors[v*3];im.data[i+1]=colors[v*3+1];im.data[i+2]=colors[v*3+2];im.data[i+3]=255}}c.putImageData(im,0,0);L.background={key,image}}
 cv.width=w;cv.height=h;const c=cv.getContext('2d');c.drawImage(L.background.image,0,0);
 const viewport=$('lesionViewport'),fit=Math.max(80,Math.min(viewport.clientWidth-20,(viewport.clientHeight-20)*aspect)),zoom=Number($('lesionZoom').value)/100;cv.style.width=Math.round(fit*zoom)+'px';cv.style.height=Math.round(fit/aspect*zoom)+'px';$('lesionZoomValue').textContent=Math.round(zoom*100)+'%';
 const selected=lesionSelected(),scale=w/(cv.getBoundingClientRect().width||w);
 for(const lesion of L.project.lesions){const r=lesion===selected&&L.edit?L.edit:lesionRecord(lesion);if(r&&!r.absent)lesionPolygon(c,r.points,w,h,lesion.color,lesion===selected&&!L.draft,scale,lesion===selected&&L.draft?.points.length?0.05:0.16)}
 if(L.draft){const p=L.draft.points;if(p.length){c.save();c.strokeStyle=c.fillStyle=selected.color;c.lineWidth=2*scale;c.beginPath();p.forEach((q,i)=>{const x=(q[0]-crop.x)/(crop.w-1)*w,y=(q[1]-crop.y)/(crop.h-1)*h;i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();for(const q of p){c.beginPath();c.arc((q[0]-crop.x)/(crop.w-1)*w,(q[1]-crop.y)/(crop.h-1)*h,3.8*scale,0,Math.PI*2);c.fill()}c.restore()}}
 const r=lesionRecord(selected),a=r?(r.absent?0:LesionMath.area(r.points)):null;$('lesionAreaNow').textContent=a===null?'No section annotation':cal[0]&&cal[2]?lesionFormat(a*cal[0]*cal[2],'µm²'):lesionFormat(a,'px²');
}
function lesionPolygon(c,points,w,h,color,vertices=false,scale=1,alpha=.16){const crop=S.crop;c.save();c.beginPath();points.forEach((p,i)=>{const x=(p[0]-crop.x)/(crop.w-1)*w,y=(p[1]-crop.y)/(crop.h-1)*h;i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();c.fillStyle=color;c.globalAlpha=alpha;c.fill();c.globalAlpha=1;c.lineWidth=2*scale;c.strokeStyle=color;c.stroke();if(vertices)for(const p of points){c.beginPath();c.arc((p[0]-crop.x)/(crop.w-1)*w,(p[1]-crop.y)/(crop.h-1)*h,3.5*scale,0,Math.PI*2);c.fillStyle='#07111b';c.fill();c.stroke()}c.restore()}
function lesionUpdate(){
 if(!L.project)return;const selected=lesionSelected();$('lesionSelect').replaceChildren();for(const lesion of L.project.lesions){const o=document.createElement('option');o.value=lesion.id;o.textContent=lesion.name;$('lesionSelect').append(o)}
 $('lesionSelect').value=selected?.id||'';$('lesionName').value=selected?.name||'';$('lesionType').value=selected?.type||'Laser CNV';$('lesionInterpolate').checked=L.project.interpolate;
 $('lesionFrame').value=L.frame;$('lesionSourceName').textContent=lesionFrameId(S.sources[L.frame]);$('lesionPrev').disabled=L.frame===0||!!L.draft;$('lesionNext').disabled=L.frame===S.n-1||!!L.draft;
 for(const id of ['lesionFinish','lesionBackPoint','lesionDiscard'])$(id).disabled=!L.draft;
 for(const id of ['lesionDraw','lesionAbsent','lesionRemoveSection','lesionCopy'])$(id).disabled=!selected||!!L.draft;
 $('lesionRemoveSection').disabled=!!L.draft||!lesionRecord(selected);$('lesionUndo').disabled=!L.project.undo.length||!!L.draft;
 for(const id of ['lesionName','lesionType','lesionDelete'])$(id).disabled=!selected;
 const result=selected?lesionAnalysis(selected):null;$('lesionVolume').textContent=lesionFormat(result?.volumeUm3??null,'µm³');$('lesionMm3').textContent=result?.volumeMm3!==null&&result?.volumeMm3!==undefined?lesionFormat(result.volumeMm3,'mm³'):'';
 $('lesionMaxArea').textContent=lesionFormat(result?.maxAreaUm2??null,'µm²');$('lesionSpan').textContent=lesionFormat(result?.spanUm??null,'µm');
 $('lesionQuality').textContent=!result?'Add a lesion to begin.':result.volumeUm3===null?'Not yet calculated':result.bounded?'Absent boundaries recorded':'Partial extent · lesion present at an end';$('lesionQuality').classList.toggle('partial',!!result&&!result.bounded);
 $('lesionResultNote').textContent=result?.reason||(result?`${result.positive} outlined · ${result.reviewed} reviewed scans${result.missing?` · ${result.missing} unoutlined scans interpolated`:' · all scans in this range reviewed'}. ${result.bounded?'':'Mark an absent scan before and after the lesion to bound its full extent.'}`:'');
 const outside=selected&&Object.values(selected.sections).some(r=>r.points?.some(p=>p[0]<S.crop.x||p[0]>S.crop.x+S.crop.w-1||p[1]<S.crop.y||p[1]>S.crop.y+S.crop.h-1));
 $('lesionSamplingNote').textContent=(S.n<S.total?`${S.n} / ${S.total} scans loaded. Gaps use original discovered-scan intervals. Open a smaller contiguous range for dense review. `:'')+(outside?'Some saved vertices lie outside this crop; area uses the full saved contour. Restore the crop to review them.':'One closed contour per lesion per acquired scan. Areas use original source coordinates.');
 $('lesionSections').replaceChildren();for(const row of result?.rows||[]){const tr=document.createElement('tr');tr.classList.toggle('active',row.frame===lesionFrameId(S.sources[L.frame]));for(const value of [row.ordinal+1,lesionFormat(row.yUm),lesionFormat(row.areaUm2),row.absent?'Absent':row.method==='copied'?'Copied outline':row.method==='edited'?'Edited outline':'Manual outline']){const td=document.createElement('td');td.textContent=value;tr.append(td)}const td=document.createElement('td'),button=document.createElement('button');button.textContent='Go';button.setAttribute('aria-label','Go to scan '+(row.ordinal+1));button.onclick=()=>{const i=(L.indexMap.get(row.frame)??-1);if(i>=0)lesionSetFrame(i)};td.append(button);tr.append(td);$('lesionSections').append(tr)}
 lesionDrawProfile(result);lesionBadge();
}
function lesionDrawProfile(result){const cv=$('lesionProfile');cv.width=900;cv.height=110;const c=cv.getContext('2d'),rows=result?.rows||[];c.fillStyle='#0b1621';c.fillRect(0,0,900,110);c.font='11px system-ui';c.fillStyle='#9bb6c8';c.fillText(result?.maxAreaUm2===null?'Section area · source px²':'Section area · µm²',10,16);if(!rows.length)return;const first=rows[0].ordinal,last=rows.at(-1).ordinal,max=Math.max(1,...rows.map(r=>r.areaUm2??r.areaPx2)),x=r=>35+(r.ordinal-first)/Math.max(1,last-first)*830,y=r=>85-(r.areaUm2??r.areaPx2)/max*55;
 c.strokeStyle='#426176';c.beginPath();c.moveTo(35,86);c.lineTo(865,86);c.stroke();c.strokeStyle=lesionSelected().color;c.lineWidth=2;for(let i=1;i<rows.length;i++){c.setLineDash(rows[i].ordinal-rows[i-1].ordinal>1?[6,4]:[]);c.beginPath();c.moveTo(x(rows[i-1]),y(rows[i-1]));c.lineTo(x(rows[i]),y(rows[i]));c.stroke()}c.setLineDash([]);for(const r of rows){c.beginPath();c.arc(x(r),y(r),3.5,0,Math.PI*2);c.fillStyle=r.absent?'#7d98ad':lesionSelected().color;c.fill()}c.fillStyle='#8aa8ba';c.fillText('Scan '+(first+1),10,103);c.textAlign='right';c.fillText('Scan '+(last+1)+' · dashed = unoutlined scans',880,103)}

function drawLesionSlice(canvas,c,enabled=true){
 if(!enabled||!L.project||!$('showLesionOverlay').checked||Math.abs(S.yaw)>.001||Math.abs(S.tilt)>.001)return;
 const index=S.center[1]*Math.max(0,S.n-1);if(Math.abs(index-Math.round(index))>.001)return;
 for(const lesion of L.project.lesions){const record=lesionRecord(lesion,Math.round(index));if(!record||record.absent)continue;c.save();c.translate((.5-S.center[0])*canvas.width,(.5-S.center[2])*canvas.height);lesionPolygon(c,record.points,canvas.width,canvas.height,lesion.color);c.restore()}
}
function drawLesion3D(c,project,channel){
 if(!L.project||!$('showLesionOverlay').checked)return;
 for(const lesion of L.project.lesions){const records=Object.values(lesion.sections).filter(r=>!r.absent),stride=Math.max(1,Math.ceil(records.length/50));for(let j=0;j<records.length;j+=stride){const r=records[j],i=(L.indexMap.get(r.frame)??-1);if(i<0||r.points.some(p=>p[0]<S.crop.x||p[0]>S.crop.x+S.crop.w-1||p[1]<S.crop.y||p[1]>S.crop.y+S.crop.h-1))continue;c.save();c.strokeStyle=channel==='red'?'#ff0000':channel==='cyan'?'#00ffff':lesion.color;c.lineWidth=1.8;c.beginPath();r.points.forEach((p,k)=>{const q=[(p[0]-S.crop.x)/(S.crop.w-1),i/Math.max(1,S.n-1),(p[1]-S.crop.y)/(S.crop.h-1)],a=project(q.map((v,axis)=>(v-.5)*S.ext[axis]));k?c.lineTo(...a):c.moveTo(...a)});c.closePath();c.stroke();c.restore()}}
}
function drawLesionFundus(c){
 if(!L.project||!$('showLesionOverlay').checked)return;
 for(const lesion of L.project.lesions){c.save();c.strokeStyle=lesion.color;c.lineWidth=3;for(const r of Object.values(lesion.sections)){if(r.absent)continue;const i=(L.indexMap.get(r.frame)??-1),trace=i<0?null:traceAt(i/Math.max(1,S.n-1));if(!trace)continue;const xs=r.points.map(p=>(p[0]-S.crop.x)/(S.crop.w-1)),a=Math.max(0,Math.min(...xs)),b=Math.min(1,Math.max(...xs));if(b<=a)continue;c.beginPath();c.moveTo(trace.x0+a*(trace.x1-trace.x0),trace.y);c.lineTo(trace.x0+b*(trace.x1-trace.x0),trace.y);c.stroke()}c.restore()}
}

function validateLesionProject(data,source,frames){
 if(data?.schema!=='oct-lesion-rois'||data.version!==1)throw Error('Choose an OCT lesion ROI project (version 1).');
 if(!data.source||data.source.width!==source.width||data.source.height!==source.height||data.source.scans!==source.scans||JSON.stringify(data.source.files)!==JSON.stringify(source.files)||JSON.stringify(data.source.fingerprints)!==JSON.stringify(source.fingerprints))throw Error('This ROI project belongs to a different image sequence. Open the matching complete volume first.');
 if(!Array.isArray(data.lesions)||data.lesions.length>100)throw Error('A project supports at most 100 lesions.');
 if(!Array.isArray(data.spacing)||data.spacing.length!==3||data.spacing.some(v=>v!==null&&(!Number.isFinite(v)||v<=0)))throw Error('Invalid spacing in ROI project.');
 if(![source.width*(data.spacing[0]||1),source.height*(data.spacing[2]||1),source.scans*(data.spacing[1]||1)].every(Number.isFinite))throw Error('Physical dimensions exceed the numeric range; check calibration.');
 const ids=new Set(),lookup=new Map(frames.map(f=>[f.frame,f.ordinal]));let vertices=0;
 const lesions=data.lesions.map((l,index)=>{
  if(typeof l.id!=='string'||l.id.length>80||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80||!l.sections||Array.isArray(l.sections)||typeof l.sections!=='object')throw Error('Invalid lesion entry.');ids.add(l.id);
  const sections=Object.create(null);
  for(const [key,r]of Object.entries(l.sections)){
   if(!r||key!==r.frame||!lookup.has(key)||r.ordinal!==lookup.get(key)||typeof r.absent!=='boolean')throw Error('A contour does not match an acquired scan in this volume.');
   const points=r.absent?[]:r.points,error=r.absent?null:LesionMath.polygonError(points,source.width,source.height);if(error)throw Error(error);
   vertices+=points.length;if(vertices>100000)throw Error('ROI project has too many vertices.');
   sections[key]={frame:key,ordinal:r.ordinal,absent:r.absent,points:points.map(p=>[...p]),method:r.absent?'absent':['drawn','edited','copied'].includes(r.method)?r.method:'drawn'};
  }
  return {id:l.id,name:l.name.trim(),type:['Laser CNV','Other injury','Custom ROI'].includes(l.type)?l.type:'Custom ROI',color:L.colors[index%L.colors.length],sections};
 });
 return {lesions,selected:ids.has(data.selected)?data.selected:lesions[0]?.id||null,interpolate:data.interpolate!==false,spacing:data.spacing,next:Math.max(1,...lesions.map(l=>Number(l.id.match(/^lesion-(\d+)$/)?.[1]||0)+1))};
}
function lesionSave(){if(!lesionCanLeave())return;const data={schema:'oct-lesion-rois',version:1,savedAt:new Date().toISOString(),source:L.project.source,dataset:S.label,coordinateSystem:'Original source pixel centers; x lateral, z depth; ordinal in discovered scan order',spacing:axisCalibration(),spacingUnits:['µm/source pixel X','µm/discovered scan interval Y','µm/source pixel Z'],method:'Trapezoidal area integration between annotated scan centers; no extrapolation',interpolate:L.project.interpolate,selected:L.project.selected,lesions:L.project.lesions};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),exportName('lesion_ROIs.json'));lesionMessage('ROI project saved with all lesions and calibration. Images are not included.')}
async function lesionLoad(file){
 try{if(!lesionCanLeave())return;if(file.size>5*1024*1024)throw Error('ROI project exceeds 5 MB.');const data=JSON.parse(await file.text()),frames=S.sources.map((s,i)=>({frame:lesionFrameId(s),ordinal:S.sourceIndices[i]})),loaded=validateLesionProject(data,L.project.source,frames);lesionRemember();Object.assign(L.project,{lesions:loaded.lesions,selected:loaded.selected,interpolate:loaded.interpolate,next:loaded.next});
  if($('lesionRestoreSpacing').checked){['sx','sy','sz'].forEach((id,i)=>$(id).value=loaded.spacing[i]??'');S.scaleApplied=false;$('scaleReadout').textContent='ROI project spacing applied · image marker available for review';updateGeometry()}
  L.background=null;lesionFillSpacing();lesionUpdate();lesionDrawEditor();refresh();lesionMessage('ROI project loaded and matched to this image sequence. Undo restores the previous lesions.');
 }catch(e){lesionMessage(e.message||String(e),true)}
}
function lesionCsvCell(value){if(value===null||value===undefined)return '';if(typeof value==='number')return Number.isFinite(value)?String(value):'';let s=String(value);if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function lesionExportCsv(sections=false){
 if(!lesionCanLeave())return;const spacing=axisCalibration(),created=new Date().toISOString(),common=['dataset','lesion_id','lesion_name','injury_type'];let rows;
 if(sections){rows=[[...common,'scan_number','source_frame','y_um','area_um2','area_source_px2','annotation','sx_um_per_px','sy_um_per_scan','sz_um_per_px','exported_at']];for(const l of L.project.lesions)for(const r of lesionAnalysis(l).rows)rows.push([S.label,l.id,l.name,l.type,r.ordinal+1,r.frame,r.yUm,r.areaUm2,r.areaPx2,r.absent?'absent':r.method,...spacing,created])}
 else{rows=[[...common,'volume_um3','volume_mm3','max_area_um2','measured_y_span_um','first_annotated_scan','last_annotated_scan','reviewed_scans','outlined_scans','unoutlined_scans','max_gap_scan_intervals','bounded_by_absent_scans','area_interpolation_enabled','sx_um_per_px','sy_um_per_scan','sz_um_per_px','method','status','exported_at']];for(const l of L.project.lesions){const r=lesionAnalysis(l);rows.push([S.label,l.id,l.name,l.type,r.volumeUm3,r.volumeMm3,r.maxAreaUm2,r.spanUm,r.rows[0]?.ordinal+1||null,r.rows.at(-1)?.ordinal+1||null,r.reviewed,r.positive,r.missing,r.maxGap,r.bounded,L.project.interpolate,...spacing,'Trapezoidal integration between scan centers; no extrapolation',r.reason||(r.bounded?'bounded measured range':'partial lesion extent'),created])}}
 downloadBlob(new Blob(['\ufeff'+rows.map(row=>row.map(lesionCsvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),exportName(sections?'lesion_section_areas.csv':'lesion_volumes.csv'));lesionMessage('CSV exported with calibration, reviewed scans and analysis method.')
}
function initLesionUI(){
 L.initialized=true;$('lesionAnalysis').onclick=lesionOpen;
 $('lesionAdd').onclick=lesionAdd;
 $('lesionSelect').onchange=()=>{if(!lesionCanLeave()){$('lesionSelect').value=L.project.selected;return}L.project.selected=$('lesionSelect').value;lesionUpdate();lesionDrawEditor()};
 $('lesionName').oninput=()=>{const lesion=lesionSelected(),name=$('lesionName').value.trim();if(!lesion||!name)return;if(L.nameEditing!==lesion.id){lesionRemember();L.nameEditing=lesion.id}lesion.name=name;const option=$('lesionSelect').selectedOptions[0];if(option)option.textContent=name};
 $('lesionName').onblur=()=>{L.nameEditing=null;if(lesionSelected())$('lesionName').value=lesionSelected().name};
 $('lesionType').onchange=()=>{lesionRemember();lesionSelected().type=$('lesionType').value;lesionUpdate()};
 $('lesionDelete').onclick=()=>{if(!lesionCanLeave())return;lesionRemember();L.project.lesions=L.project.lesions.filter(l=>l.id!==L.project.selected);L.project.selected=L.project.lesions[0]?.id||null;lesionUpdate();lesionDrawEditor();refresh();lesionMessage('Lesion removed. Undo change restores it.')};
 $('lesionUndo').onclick=()=>{if(!lesionCanLeave()||!L.project.undo.length)return;Object.assign(L.project,JSON.parse(L.project.undo.pop()));lesionUpdate();lesionDrawEditor();refresh();lesionMessage('Previous lesion state restored. Calibration is unchanged.')};
 $('lesionInterpolate').onchange=()=>{lesionRemember();L.project.interpolate=$('lesionInterpolate').checked;lesionUpdate()};
 $('showLesionOverlay').onchange=refresh;
 $('lesionPrev').onclick=()=>lesionSetFrame(L.frame-1);$('lesionNext').onclick=()=>lesionSetFrame(L.frame+1);$('lesionFrame').onchange=()=>lesionSetFrame(Number($('lesionFrame').value));
 $('lesionDraw').onclick=lesionStart;$('lesionFinish').onclick=lesionFinish;$('lesionDiscard').onclick=lesionDiscard;
 $('lesionBackPoint').onclick=()=>{L.draft?.points.pop();lesionDrawEditor()};
 $('lesionAbsent').onclick=()=>{lesionCommit({...lesionSectionBase(),points:[],absent:true,method:'absent'});lesionMessage('Lesion marked absent on this scan (zero cross-sectional area).')};
 $('lesionRemoveSection').onclick=()=>{lesionRemember();delete lesionSelected().sections[lesionFrameId(S.sources[L.frame])];lesionUpdate();lesionDrawEditor();refresh();lesionMessage('Section annotation removed. This scan is now unreviewed.')};
 $('lesionCopy').onclick=()=>{const previous=Object.values(lesionSelected().sections).filter(r=>!r.absent&&r.ordinal<S.sourceIndices[L.frame]).sort((a,b)=>b.ordinal-a.ordinal)[0];if(!previous){lesionMessage('No earlier outline is available to copy.',true);return}L.draft={points:previous.points.map(p=>[...p]),method:'copied'};lesionUpdate();lesionDrawEditor();lesionMessage(`Outline copied from scan ${previous.ordinal+1}. Finish it to save, then drag vertices to adjust.`)};
 $('lesionZoom').oninput=lesionDrawEditor;$('lesionFit').onclick=()=>{$('lesionZoom').value=100;lesionDrawEditor();$('lesionViewport').scrollTo(0,0)};
 $('lesionApplySpacing').onclick=()=>{const values=['lesionSx','lesionSy','lesionSz'].map(id=>$(id).value);if(values.some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<=0))){lesionMessage('Spacing must be positive, or blank if unknown.',true);return}if(![S.crop.w*(Number(values[0])||1),S.total*(Number(values[1])||1),S.crop.h*(Number(values[2])||1)].every(Number.isFinite)){lesionMessage('Physical dimensions exceed the numeric range; check spacing.',true);return}['sx','sy','sz'].forEach((id,i)=>$(id).value=values[i]);S.scaleApplied=false;$('scaleReadout').textContent='Entered spacing applied · image marker available for review';S.points=[];updateGeometry();lesionFillSpacing();lesionUpdate();L.background=null;lesionDrawEditor();refresh();lesionMessage('Spacing applied. Areas and volumes recalculated from the original contour coordinates.')};
 $('lesionUseRange').onclick=()=>{const range=Number($('lesionYrange').value);if(!(range>0&&Number.isFinite(range))||S.total<2){lesionMessage('Enter a positive first-to-last scan-center range for at least two scans.',true);return}$('lesionSy').value=range/(S.total-1);$('lesionApplySpacing').click()};
 $('lesionSaveProject').onclick=lesionSave;$('lesionLoadProject').onclick=()=>{if(lesionCanLeave())$('lesionProjectInput').click()};$('lesionProjectInput').onchange=e=>{const file=e.target.files[0];if(file)lesionLoad(file);e.target.value=''};
 $('lesionSummaryCsv').onclick=()=>lesionExportCsv();$('lesionSectionsCsv').onclick=()=>lesionExportCsv(true);
 $('lesionToMain').onclick=()=>{if(!lesionCanLeave())return;S.center=[.5,L.frame/Math.max(1,S.n-1),.5];S.yaw=S.tilt=0;S.points=[];syncControls();$('lesionDialog').close();refresh()};
 $('lesionClose').onclick=()=>{if(lesionCanLeave())$('lesionDialog').close()};
 $('lesionDialog').addEventListener('cancel',e=>{if(L.draft){e.preventDefault();lesionDiscard()}});
 $('lesionDialog').addEventListener('close',()=>{L.draft=L.edit=L.drag=null;L.background=null;refresh()});
 $('lesionDialog').addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='Enter'&&L.draft){e.preventDefault();lesionFinish()}else if((e.key==='Backspace'||e.key==='Delete')&&L.draft){e.preventDefault();L.draft.points.pop();lesionDrawEditor()}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();lesionSetFrame(L.frame+(e.key==='ArrowRight'?1:-1))}});
 const canvas=$('lesionCanvas');
 canvas.onclick=e=>{if(!L.draft||e.detail>1)return;if(L.draft.points.length>=3&&lesionHit([L.draft.points[0]],e)===0){lesionFinish();return}if(L.draft.points.length>=512){lesionMessage('Maximum 512 vertices per contour.',true);return}const p=lesionPoint(e),previous=L.draft.points.at(-1);if(!previous||Math.hypot(p[0]-previous[0],p[1]-previous[1])>.01)L.draft.points.push(p);lesionDrawEditor();lesionMessage(`${L.draft.points.length} vertices · Enter or Finish contour to save.`)};
 canvas.ondblclick=e=>{e.preventDefault();if(L.draft)lesionFinish()};
 canvas.onpointerdown=e=>{if(L.draft||e.button!==0)return;const r=lesionRecord(lesionSelected());if(!r||r.absent)return;const vertex=lesionHit(r.points,e);if(vertex<0)return;L.edit={...r,points:r.points.map(p=>[...p])};L.drag={vertex,changed:false};canvas.setPointerCapture(e.pointerId)};
 canvas.onpointermove=e=>{if(!L.drag)return;L.edit.points[L.drag.vertex]=lesionPoint(e);L.drag.changed=true;lesionDrawEditor()};
 canvas.onpointerup=e=>{if(!L.drag)return;const edited=L.edit,changed=L.drag.changed;L.drag=null;L.edit=null;if(changed){const source=S.sources[L.frame],error=LesionMath.polygonError(edited.points,source.w,source.h);if(error){lesionMessage(error+' Previous contour retained.',true);lesionDrawEditor();return}lesionCommit({...edited,method:'edited'});lesionMessage('Contour updated; physical area and volume recalculated.')}else lesionDrawEditor()};
 canvas.onpointercancel=()=>{L.edit=L.drag=null;lesionDrawEditor()};
 new ResizeObserver(()=>{if($('lesionDialog').open)lesionDrawEditor()}).observe($('lesionViewport'));
}

function drawLesionEnface(c,w,h){
 if(!L.project||!$('showLesionOverlay').checked)return;
 for(const lesion of L.project.lesions){c.save();c.strokeStyle=lesion.color;c.lineWidth=3;for(const r of Object.values(lesion.sections)){if(r.absent)continue;const i=L.indexMap.get(r.frame);if(i===undefined)continue;const xs=r.points.map(p=>(p[0]-S.crop.x)/(S.crop.w-1)),a=Math.max(0,Math.min(...xs)),b=Math.min(1,Math.max(...xs));if(b<=a)continue;const y=i/Math.max(1,S.n-1)*h;c.beginPath();c.moveTo(a*w,y);c.lineTo(b*w,y);c.stroke()}c.restore()}
}

