'use strict';
(function(){
 const W=WebEngine,baseStart=startAIVoiceCall,baseEnd=actions.endAIVoice;
 async function createLiveSession(url,key,session,sdp){
  const request={url:url.replace(/\/$/,'')+'/live/sessions',headers:{Authorization:'Bearer '+key},body:{session,transport:{type:'webrtc',sdp}}};
  if(window.Desktop){const r=await Desktop.invoke('http',request);if(!r.ok)throw Error('GPT-Live HTTP '+r.status+'：'+(r.value?.error?.message||r.value?.error||'連線失敗'));return r.value;}
  const r=await fetch('/v1/proxy',{method:'POST',headers:{'Content-Type':'application/json','X-Mushui-Web-Session':await W.session()},body:JSON.stringify(request)}),data=await r.json();if(!r.ok)throw Error('GPT-Live HTTP '+r.status+'：'+(data.error?.message||data.error||'連線失敗'));return data;
 }
 const placeholderKey=value=>/^(?:YOUR_KEY|YOUR_API_KEY|YOUR_KEY_HERE|sk-\.\.\.)$/i.test(String(value||'').trim());
 async function liveApiKey(settings,base){
  const dedicated=await W.key('live');if(dedicated&&!placeholderKey(dedicated))return dedicated;
  const target=new URL(base).origin;
  for(const [slot,service] of [['chat',settings.baseUrl],['voice',settings.voiceBaseUrl||'https://api.openai.com/v1'],['tts',settings.ttsBaseUrl||'https://api.openai.com/v1']]){
   if(!service)continue;
   try{if(new URL(service).origin===target){const key=await W.key(slot);if(key&&!placeholderKey(key))return key;}}catch{}
  }
  if(dedicated&&placeholderKey(dedicated))throw Error('GPT-Live 金鑰目前是範例文字 YOUR_KEY，請在「音色與語音回覆」填入實際 API 金鑰，或使用同網站已保存的聊天／語音金鑰。');
  return '';
 }
 function waitIce(pc){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve();}};pc.addEventListener('icegatheringstatechange',done);setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve();},7000);});}
 async function logLive(c,author,text,kind){text=String(text||'').trim();if(!text||text===c.lastText)return;c.lastText=text;await W.edit(s=>{const chat=s.chats.find(x=>x.id===c.chat);if(chat)W.append(chat,author,text,{liveVoice:true,...(kind==='call'?{callEvent:true}:{})});});state=await call('load');if(chatId===c.chat)render();}
 startAIVoiceCall=async id=>{
  const s=await W.read(),a=W.find(s.ais,id),v={liveEnabled:false,liveModel:'gpt-live-1',livePrompt:'',...a.voiceProfile};
  if(!v.liveEnabled)return baseStart(id);
  if(liveVoice||VoiceUI.rtc||VoiceUI.recorder)throw Error('請先結束目前錄音或通話');
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('此裝置不支援 GPT-Live WebRTC 語音通話');
  const target=W.dm(s,id).id;await W.edit(current=>{if(!current.chats.some(c=>c.id===target))current.chats.push(s.chats.find(c=>c.id===target));});
  const base=W.url(s.settings.liveBaseUrl||'https://api.openai.com/v1'),key=await liveApiKey(s.settings,base);if(!key)throw Error('找不到 GPT-Live API 金鑰。請在音色設定填寫金鑰，或先保存與 GPT-Live 相同網站的 API 金鑰。');
  const mic=await call('microphone');if(mic?.granted===false)throw Error('請允許麥克風權限');await call('voiceSession',{active:true});
  let media=null,pc=null;try{media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});pc=new RTCPeerConnection();}catch(e){await call('voiceSession',{active:false}).catch(()=>{});throw e;}const dc=pc.createDataChannel('oai-events'),c={ai:id,chat:target,liveSession:true,pc,dc,media,ending:false,seenEvents:new Set(),remoteAudio:null};liveVoice=c;VoiceUI.ai=c;closeModal();
  pc.ontrack=e=>{const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.className='live-audio-output';document.body.append(audio);c.remoteAudio=audio;if(typeof routeOutput==='function')Promise.resolve(routeOutput(audio)).catch(()=>{});audio.play().catch(()=>{});};
  dc.onmessage=e=>{let x;try{x=JSON.parse(e.data);}catch{return;}const key=x.item_id||x.event_id||x.response_id||x.type+':'+(x.transcript||x.delta||'');if(c.seenEvents.has(key))return;if(x.type==='conversation.item.input_audio_transcription.completed'&&x.transcript){c.seenEvents.add(key);void logLive(c,'me','［GPT-Live 通話］'+x.transcript,'speech');}else if((x.type==='response.output_audio_transcript.done'||x.type==='response.audio_transcript.done')&&x.transcript){c.seenEvents.add(key);void logLive(c,id,x.transcript,'speech');}else if(x.type==='session.started')callScreen(a.name,'GPT-Live 通話中 · 可以直接說話','<button class="pill hangup" data-action="endAIVoice">掛斷</button>');else if(x.type==='error')c.error=x.error?.message||'GPT-Live 發生錯誤';};
  try{
   for(const track of media.getTracks())pc.addTrack(track,media);
   const recent=(s.chats.find(x=>x.id===target)?.messages||[]).slice(-24).map(m=>(m.author==='me'?'使用者':W.person(s,m.author))+': '+String(m.text||'').slice(0,500)).join('\n');
   const instructions=[`你是${a.name}。以繁體中文自然即時對話，遵循你的角色個性，回答簡短，像熟悉的人通話；允許打斷與自然停頓。不要替其它角色說話。`, '角色個性：'+a.personality, '長期記憶：'+(a.summary||'無'), '永久外貌（不得更改）：'+(a.appearance||'尚未建立'), '最近聊天背景：'+(recent||'沒有近期文字聊天'), v.livePrompt?'自訂音色原始描述：'+v.livePrompt:''].join('\n');
   const voice=String(v.voice||'coral'),outputVoice=voice.startsWith('voice_')?{id:voice}:voice;
   const session={model:v.liveModel||'gpt-live-1',instructions,audio:{output:{voice:outputVoice}}};
   dc.addEventListener('open',()=>{}, {once:true});const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitIce(pc);const result=await createLiveSession(base,key,session,pc.localDescription?.sdp||offer.sdp);if(!result?.transport?.sdp)throw Error('GPT-Live 沒有傳回 WebRTC 回應');await pc.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
   await logLive(c,id,'☎ GPT-Live 通話已開始。','call');callScreen(a.name,'正在連接 GPT-Live…','<button class="pill hangup" data-action="endAIVoice">掛斷</button>');
  }catch(e){media?.getTracks().forEach(t=>t.stop());pc?.close();await call('voiceSession',{active:false}).catch(()=>{});liveVoice=null;VoiceUI.ai=null;hideCall();throw e;}
 };
 actions.endAIVoice=async()=>{const c=liveVoice;if(!c?.liveSession)return baseEnd();if(c.ending)return;c.ending=true;try{await logLive(c,c.ai,'☎ GPT-Live 通話已結束。','call');}finally{c.dc?.close();c.pc?.close();c.media?.getTracks().forEach(t=>t.stop());c.remoteAudio?.remove();await call('voiceSession',{active:false}).catch(()=>{});liveVoice=null;VoiceUI.ai=null;hideCall();state=await call('load');render();}};
})();
