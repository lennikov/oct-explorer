/* @repo-annotation: 03-video-codecs.js
 * Seekable EBML/WebM muxing, WebCodecs encoding and frame-by-frame MediaRecorder fallback.
 * The build script strips this note; the canonical recovered HTML remains byte-exact.
 */
// Local WebCodecs -> seekable WebM. Timestamps are independent of render speed.
// Container: https://www.webmproject.org/docs/container/
const joinBytes=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length}return out};
function ebmlUint(value,min=1){const out=[];do{out.unshift(value%256);value=Math.floor(value/256)}while(value>0);while(out.length<min)out.unshift(0);return Uint8Array.from(out)}
function ebmlSize(value){let size=1;while(value>=2**(7*size)-1)size++;const b=ebmlUint(value,size);b[0]|=1<<(8-size);return b}
const ebml=(id,data)=>joinBytes([ebmlUint(id),ebmlSize(data.length),data]);
const ebmlNum=(id,n)=>ebml(id,ebmlUint(n));
const ebmlText=(id,text)=>ebml(id,new TextEncoder().encode(text));
function muxWebM(frames,{width,height,fps,seconds,codec}){
 if(!frames.length||!frames[0].key)throw Error('Video encoder did not produce an initial keyframe.');
 const duration=new Uint8Array(8);new DataView(duration.buffer).setFloat64(0,seconds*1000);
 const header=ebml(0x1a45dfa3,joinBytes([ebmlNum(0x4286,1),ebmlNum(0x42f7,1),ebmlNum(0x42f2,4),ebmlNum(0x42f3,8),ebmlText(0x4282,'webm'),ebmlNum(0x4287,4),ebmlNum(0x4285,2)]));
 const info=ebml(0x1549a966,joinBytes([ebmlNum(0x2ad7b1,1000000),ebml(0x4489,duration),ebmlText(0x4d80,'OCT Volume Studio'),ebmlText(0x5741,'OCT Volume Studio')]));
 const tracks=ebml(0x1654ae6b,ebml(0xae,joinBytes([ebmlNum(0xd7,1),ebmlNum(0x73c5,1),ebmlNum(0x83,1),ebmlNum(0x9c,0),ebmlText(0x86,codec.startsWith('vp09')?'V_VP9':'V_VP8'),ebmlNum(0x23e383,Math.round(1e9/fps)),ebml(0xe0,joinBytes([ebmlNum(0xb0,width),ebmlNum(0xba,height)]))])));
 const clusters=[];let current=null;
 for(const f of frames){const t=Math.round(f.timestamp/1000);if(!current||(f.key&&t-current.time>=1000)){current={time:t,blocks:[]};clusters.push(current)}const delta=t-current.time;if(delta>32767)throw Error('Video cluster timestamp exceeded range.');current.blocks.push(ebml(0xa3,joinBytes([Uint8Array.of(0x81,(delta>>8)&255,delta&255,f.key?0x80:0),f.data])))}
 const encoded=clusters.map(c=>ebml(0x1f43b675,joinBytes([ebmlNum(0xe7,c.time),...c.blocks]))),clusterBytes=encoded.reduce((n,b)=>n+b.length,0);
 const seek=(id,position)=>ebml(0x4dbb,joinBytes([ebml(0x53ab,ebmlUint(id)),ebmlNum(0x53ac,position)]));
 let seekHead=new Uint8Array();for(let i=0;i<8;i++){const next=ebml(0x114d9b74,joinBytes([seek(0x1549a966,seekHead.length),seek(0x1654ae6b,seekHead.length+info.length),seek(0x1c53bb6b,seekHead.length+info.length+tracks.length+clusterBytes)]));const stable=next.length===seekHead.length;seekHead=next;if(stable)break}
 let pos=seekHead.length+info.length+tracks.length;
 const cues=ebml(0x1c53bb6b,joinBytes(clusters.map((c,i)=>{const cue=ebml(0xbb,joinBytes([ebmlNum(0xb3,c.time),ebml(0xb7,joinBytes([ebmlNum(0xf7,1),ebmlNum(0xf1,pos)]))]));pos+=encoded[i].length;return cue})));
 return new Blob([header,ebml(0x18538067,joinBytes([seekHead,info,tracks,...encoded,cues]))],{type:'video/webm'});
}
async function encoderConfig(width,height,fps){
 if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')return null;
 for(const codec of ['vp09.00.31.08','vp8']){const config={codec,width,height,framerate:fps,bitrate:Math.max(1800000,width*width*5),latencyMode:'realtime'};try{if((await VideoEncoder.isConfigSupported(config)).supported)return config}catch{}}
 return null;
}
async function encodeVideo(canvas,config,seconds,job,paint){
 const frames=[],count=Math.round(seconds*config.framerate);let error=null,totalBytes=0;
 const encoder=new VideoEncoder({output:chunk=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);totalBytes+=data.length;if(totalBytes>200*1024*1024){error=Error('Video exceeds 200 MB. Use a shorter clip or smaller size.');return}frames.push({timestamp:chunk.timestamp,key:chunk.type==='key',data})},error:e=>error=e});
 try{
  encoder.configure(config);
  for(let i=0;i<count&&!job.cancelled;i++){
   if(error)throw error;
   await paint(i/Math.max(1,count-1));if(job.cancelled)break;
   const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/config.framerate),duration:Math.round(1e6/config.framerate)});
   try{encoder.encode(frame,{keyFrame:i%(config.framerate*2)===0})}finally{frame.close()}
   if(encoder.encodeQueueSize>2)await encoder.flush();
   $('exportProgress').value=(i+1)/count;$('loadingText').textContent=`Rendering video · ${i+1} / ${count} frames`;
   await pause();
  }
  if(job.cancelled)return null;
  $('loadingText').textContent='Encoding video…';await encoder.flush();if(error)throw error;
  if(frames.length!==count)throw Error('Video encoder returned an incomplete frame sequence.');
  frames.sort((a,b)=>a.timestamp-b.timestamp);
  return muxWebM(frames,{width:canvas.width,height:canvas.height,fps:config.framerate,seconds,codec:config.codec});
 }finally{if(encoder.state!=='closed')encoder.close()}
}

// MediaRecorder fallback for contexts where WebCodecs is unavailable. Recover
// encoded VP8/VP9 blocks, then write a duration and seek index into a new WebM.
function readRecordedWebM(bytes){
 const read=(pos,size=false)=>{if(pos>=bytes.length)throw Error('Incomplete recorded WebM.');let n=1;while(n<=8&&!(bytes[pos]&(1<<(8-n))))n++;if(n>8||pos+n>bytes.length)throw Error('Invalid WebM header.');let value=size?bytes[pos]&((1<<(8-n))-1):bytes[pos],unknown=size&&value===((1<<(8-n))-1);for(let i=1;i<n;i++){value=value*256+bytes[pos+i];unknown=unknown&&bytes[pos+i]===255}return {value,length:n,unknown}};
 const element=pos=>{const id=read(pos),size=read(pos+id.length,true),start=pos+id.length+size.length,end=size.unknown?bytes.length:start+size.value;if(end>bytes.length)throw Error('Truncated recorded WebM.');return {id:id.value,start,end,unknown:size.unknown}};
 const uint=e=>{let v=0;for(let i=e.start;i<e.end;i++)v=v*256+bytes[i];return v};
 let segment=null,p=0,scale=1000000,codec='vp8';const frames=[];
 while(p<bytes.length){const e=element(p);if(e.id===0x18538067){segment=e;break}p=e.end}
 if(!segment)throw Error('Recorder did not produce WebM.');
 const block=(e,time,keyOverride=null)=>{const track=read(e.start,true),pos=e.start+track.length;if(pos+3>e.end)throw Error('Incomplete video block.');const flags=bytes[pos+2];if(flags&6)throw Error('Laced WebM is unsupported.');const delta=new DataView(bytes.buffer,bytes.byteOffset).getInt16(pos);frames.push({timestamp:(time+delta)*scale/1000,key:keyOverride??!!(flags&128),data:bytes.slice(pos+3,e.end)})};
 for(p=segment.start;p<segment.end;){const e=element(p);if(e.id===0x1549a966){for(let q=e.start;q<e.end;){const c=element(q);if(c.id===0x2ad7b1)scale=uint(c);q=c.end}}
  if(e.id===0x1654ae6b){const scan=(start,end)=>{for(let q=start;q<end;){const c=element(q);if(c.id===0x86)codec=new TextDecoder().decode(bytes.subarray(c.start,c.end))==='V_VP9'?'vp09.00.10.08':'vp8';if(c.id===0xae)scan(c.start,c.end);q=c.end}};scan(e.start,e.end)}
  if(e.id===0x1f43b675){let time=0,q=e.start;for(;q<e.end;){const c=element(q);if(e.unknown&&[0x1f43b675,0x1c53bb6b,0x1549a966,0x1654ae6b].includes(c.id))break;if(c.id===0xe7)time=uint(c);if(c.id===0xa3)block(c,time);if(c.id===0xa0){let raw=null,key=true;for(let z=c.start;z<c.end;){const b=element(z);if(b.id===0xa1)raw=b;if(b.id===0xfb)key=false;z=b.end}if(raw)block(raw,time,key)}q=c.end}p=q}else p=e.end;
 }
 if(!frames.length)throw Error('Recorder produced no video frames.');
 return {frames,codec};
}
async function recordCanvasFrames(canvas,mime,seconds,fps,job,paint){
 if(typeof MediaRecorder==='undefined'||typeof canvas.captureStream!=='function')throw Error('This browser does not support canvas video export.');
 let stream,recorder;const chunks=[],count=Math.round(seconds*fps);
 try{
  await paint(0);if(job.cancelled)return null;
  stream=canvas.captureStream(0);let track=stream.getVideoTracks()[0];
  if(!track?.requestFrame){stream.getTracks().forEach(t=>t.stop());stream=canvas.captureStream(fps);track=stream.getVideoTracks()[0]}
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(1800000,canvas.width**2*5)});
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||Error('Video recorder failed.'))});stopped.catch(()=>{});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start(1000);
  for(let i=0;i<count&&!job.cancelled;i++){
   if(i)await paint(i/Math.max(1,count-1));if(job.cancelled)break;
   track?.requestFrame?.();
   // A complete paint and an idle interval let the recorder encode this frame
   // before CPU rendering changes the canvas again.
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   await new Promise(r=>setTimeout(r,Math.max(60,1000/fps)));
   $('exportProgress').value=(i+1)/count;$('loadingText').textContent=`Rendering video · ${i+1} / ${count} frames`;
  }
  if(recorder.state!=='inactive')recorder.stop();await stopped;if(job.cancelled)return null;
  const result=readRecordedWebM(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  result.frames.forEach((f,i)=>f.timestamp=Math.round(i*seconds*1e6/result.frames.length));
  return {blob:muxWebM(result.frames,{width:canvas.width,height:canvas.height,seconds,fps:result.frames.length/seconds,codec:result.codec}),fps:result.frames.length/seconds};
 }finally{if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop())}
}

