'use strict';
/* Hear the GPT-Live voice in everyday chat, not only during calls.
   Prompt-created Voice IDs cannot be used by the /audio/speech API
   ("Prompt-based voices are not supported by the speech API"), so when
   an AI has GPT-Live enabled with a Voice ID and the chat-voice option
   is on, W.synthesize first opens a one-shot GPT-Live (WebRTC) session
   that simply reads the text aloud in that voice and captures the
   audio. Any failure falls back to the normal speech API, and if the
   Voice ID is rejected there, to a stock voice — a voice message never
   ends up silent because of this layer. Everything runs in-app with
   the user's own configured keys, only when a voice message is made. */
function mzLiveWaitIce(pc){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}};pc.addEventListener('icegatheringstatechange',done);setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve();},7000);});}
async function mzLiveSessionPost(base,key,session,sdp){
 const request={url:base.replace(/\/$/,'')+'/live/sessions',headers:{Authorization:'Bearer '+key},body:{session,transport:{type:'webrtc',sdp}}};
 if(window.Desktop){const r=await Desktop.invoke('http',request);if(!r.ok)throw Error(r.status+'：'+(r.value?.error?.message||r.value?.error||'GPT-Live 連線失敗'));return r.value;}
 const r=await fetch('/v1/proxy',{method:'POST',headers:{'Content-Type':'application/json','X-Mushui-Web-Session':await WebEngine.session()},body:JSON.stringify(request)}),data=await r.json();if(!r.ok)throw Error(r.status+'：'+(data.error?.message||data.error||'GPT-Live 連線失敗'));return data;
}
async function mzLiveKey(settings,base){
 const dedicated=await WebEngine.key('live');if(dedicated)return dedicated;
 const target=new URL(base).origin;
 for(const [slot,service] of [['chat',settings.baseUrl],['voice',settings.voiceBaseUrl||'https://api.openai.com/v1'],['tts',settings.ttsBaseUrl||'https://api.openai.com/v1']]){
  if(!service)continue;
  try{if(new URL(service).origin===target){const key=await WebEngine.key(slot);if(key)return key;}}catch{}
 }
 return '';
}
async function mzLiveReadAloud(a,text,voiceId,settings){
 if(!window.RTCPeerConnection||!window.AudioContext)throw Error('此裝置不支援 GPT-Live 連線朗讀');
 const base=WebEngine.url(settings.liveBaseUrl||'https://api.openai.com/v1'),key=await mzLiveKey(settings,base);
 if(!key)throw Error('找不到 GPT-Live API 金鑰');
 const pc=new RTCPeerConnection(),dc=pc.createDataChannel('oai-events');
 pc.addTransceiver('audio',{direction:'recvonly'});
 const ctx=new AudioContext();
 const chunks=[];let total=0,done=false,failure='';
 const finished=new Promise(resolve=>{
  pc.ontrack=e=>{
   try{
    const src=ctx.createMediaStreamSource(e.streams[0]||new MediaStream([e.track]));
    const proc=ctx.createScriptProcessor(4096,1,1),mute=ctx.createGain();mute.gain.value=0;
    src.connect(proc);proc.connect(mute);mute.connect(ctx.destination);
    proc.onaudioprocess=ev=>{const d=ev.inputBuffer.getChannelData(0);chunks.push(new Float32Array(d));total+=d.length;};
   }catch{}
  };
  dc.addEventListener('message',e=>{let x;try{x=JSON.parse(e.data);}catch{return;}if(x.type==='error')failure=String(x.error?.message||'GPT-Live 發生錯誤');if(x.type==='response.done')done=true;});
  dc.addEventListener('open',()=>{
   try{
    dc.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:text.slice(0,1500)}]}}));
    dc.send(JSON.stringify({type:'response.create'}));
   }catch{}
  });
  (async()=>{const t0=Date.now();while(!done&&!failure&&Date.now()-t0<75000)await new Promise(r=>setTimeout(r,200));await new Promise(r=>setTimeout(r,400));resolve();})();
 });
 try{
  ctx.resume?.().catch(()=>{});
  const session={model:String(a.voiceProfile?.liveModel||'gpt-live-1'),instructions:'你是'+a.name+'。使用者會給你一段文字，你只需要用自己的聲音把這段文字逐字朗讀出來，保持角色個性與語氣；不要回答、不要評論、不要加上任何文字裡沒有的句子。',audio:{output:{voice:{id:voiceId}}}};
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await mzLiveWaitIce(pc);
  const result=await mzLiveSessionPost(base,key,session,pc.localDescription?.sdp||offer.sdp);
  if(!result?.transport?.sdp)throw Error('GPT-Live 沒有傳回連線回應');
  await pc.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
  await finished;
  if(failure)throw Error(failure);
  if(!done)throw Error('GPT-Live 朗讀逾時');
  if(!total)throw Error('GPT-Live 沒有傳回聲音');
  const mono=new Float32Array(total);let at=0;for(const c of chunks){mono.set(c,at);at+=c.length;}
  const capped=mono.slice(0,Math.floor(ctx.sampleRate*120));
  return {...voiceWav(capped,ctx.sampleRate),generated:true,liveVoice:true,truncated:text.length>1500};
 }finally{
  try{dc.close();}catch{}
  try{pc.close();}catch{}
  ctx.close().catch(()=>{});
 }
}
const mzSynthesizeBeforeLiveSpeak=WebEngine.synthesize;
WebEngine.synthesize=async(aiId,text,override={})=>{
 const s=await WebEngine.read().catch(()=>null),a=s?.ais?.find(x=>x.id===aiId),v=a?.voiceProfile||{};
 const voiceId=String(v.liveVoiceId||(String(v.voice||'').startsWith('voice_')?v.voice:''));
 if(a&&v.liveEnabled&&voiceId&&v.liveInChat!==false){
  try{return await mzLiveReadAloud(a,text,voiceId,s.settings);}
  catch(e){/* fall back to the speech API below */}
  try{return await mzSynthesizeBeforeLiveSpeak(aiId,text,override);}
  catch(e){return await mzSynthesizeBeforeLiveSpeak(aiId,text,{...override,voice:'marin'});}
 }
 return mzSynthesizeBeforeLiveSpeak(aiId,text,override);
};
