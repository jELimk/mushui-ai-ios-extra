'use strict';

const VoiceUI={recorder:null,preview:null,ai:null,rtc:null,signalCursor:0,polling:false,remoteAudio:null};

function voicePanel(html){let el=document.getElementById('voicePanel');if(!el){el=document.createElement('section');el.id='voicePanel';el.className='voice-controls';document.body.append(el);}el.innerHTML=html;}

function closeVoicePanel(){document.getElementById('voicePanel')?.remove();}

function voiceTime(n){return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');}

function voiceWav(samples,rate){

 const n=Math.max(1,Math.floor(samples.length*16000/rate)),pcm=new Float32Array(n);let sum=0,peak=0;

 for(let i=0;i<n;i++){let v=0,k=0;for(let j=Math.floor(i*rate/16000);j<Math.min(samples.length,Math.floor((i+1)*rate/16000));j++){v+=samples[j];k++;}pcm[i]=k?v/k:0;sum+=pcm[i]*pcm[i];peak=Math.max(peak,Math.abs(pcm[i]));}

 const rms=Math.sqrt(sum/n),gain=rms<.002?1:Math.min(8,.12/rms,peak?.88/peak:1),bytes=new ArrayBuffer(44+n*2),v=new DataView(bytes);function ascii(at,s){for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));}

 ascii(0,'RIFF');v.setUint32(4,36+n*2,true);ascii(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,n*2,true);

 for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.round(Math.max(-.88,Math.min(.88,pcm[i]*gain))*32767),true);

 let b='';const arr=new Uint8Array(bytes);for(let i=0;i<arr.length;i+=8192)b+=String.fromCharCode(...arr.subarray(i,i+8192));return {data:'data:audio/wav;base64,'+btoa(b),duration:n/16000,normalized:true};

}

async function openMicrophone(){const p=await call('microphone');if(!p.granted)throw Error('需要麥克風權限才能錄音與通話');if(!navigator.mediaDevices?.getUserMedia)throw Error('此裝置不支援麥克風，請確認使用 HTTPS 並更新系統');return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});}

async function pcmRecorder(onChunk=null){

 const stream=await openMicrophone();let ctx;try{ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();await call('voiceSession',{active:true});}catch(e){stream.getTracks().forEach(t=>t.stop());await ctx?.close();throw e;}

 const source=ctx.createMediaStreamSource(stream),node=ctx.createScriptProcessor(4096,1,1),silence=ctx.createGain();silence.gain.value=0;source.connect(node);node.connect(silence);silence.connect(ctx.destination);let chunks=[],length=0,closed=false;

 function take(){if(!length)return null;const samples=new Float32Array(length);let at=0;for(const c of chunks){samples.set(c,at);at+=c.length;}chunks=[];length=0;return voiceWav(samples,ctx.sampleRate);}

 node.onaudioprocess=e=>{if(closed)return;const a=new Float32Array(e.inputBuffer.getChannelData(0));chunks.push(a);length+=a.length;if(onChunk&&length>=ctx.sampleRate*30){const audio=take();onChunk(audio);}};

 return {started:Date.now(),stream,stop:async(discard=false)=>{if(closed)return null;closed=true;node.onaudioprocess=null;source.disconnect();node.disconnect();silence.disconnect();stream.getTracks().forEach(t=>t.stop());const audio=discard?null:take();await ctx.close();await call('voiceSession',{active:false});return audio;}};

}

function voiceHtml(a){return a?.data?`<div class="voice-player"><button class="voice-play" data-voice-toggle aria-label="播放語音">▶</button><div class="voice-wave" data-voice-seek role="slider" aria-label="語音進度" tabindex="0">${Array.from({length:22},(_,i)=>`<i style="--bar:${25+((i*17+7)%70)}%"></i>`).join('')}</div><time>${voiceTime(a.duration)}</time><audio class="voice-audio" preload="metadata" src="${esc(a.data)}"></audio></div><p class="voice-caption">語音 ${voiceTime(a.duration)} · 音量已平衡</p>`:'';}

document.addEventListener('click',e=>{const play=e.target.closest('[data-voice-toggle]');if(play){const box=play.closest('.voice-player'),audio=box?.querySelector('audio');if(!audio)return;document.querySelectorAll('.voice-player audio').forEach(other=>{if(other!==audio)other.pause();});if(audio.paused)audio.play().catch(()=>toast('這段語音暫時無法播放'));else audio.pause();play.textContent=audio.paused?'▶':'Ⅱ';return;}const seek=e.target.closest('[data-voice-seek]');if(seek){const audio=seek.closest('.voice-player')?.querySelector('audio');if(audio?.duration)audio.currentTime=Math.max(0,Math.min(1,(e.clientX-seek.getBoundingClientRect().left)/seek.clientWidth))*audio.duration;}});

document.addEventListener('keydown',e=>{if(e.target.matches('[data-voice-seek]')&&['ArrowLeft','ArrowRight'].includes(e.key)){const audio=e.target.closest('.voice-player')?.querySelector('audio');if(audio){audio.currentTime=Math.max(0,Math.min(audio.duration||0,audio.currentTime+(e.key==='ArrowRight'?5:-5)));e.preventDefault();}}});

document.addEventListener('play',e=>{if(e.target.matches('.voice-audio')){const b=e.target.closest('.voice-player')?.querySelector('.voice-play');b?.classList.add('is-playing');if(b)b.textContent='Ⅱ';}},true);

document.addEventListener('pause',e=>{if(e.target.matches('.voice-audio')){const b=e.target.closest('.voice-player')?.querySelector('.voice-play');b?.classList.remove('is-playing');if(b)b.textContent='▶';}},true);

document.addEventListener('timeupdate',e=>{if(!e.target.matches('.voice-audio'))return;const a=e.target,box=a.closest('.voice-player'),wave=box?.querySelector('.voice-wave'),time=box?.querySelector('time');if(wave)wave.style.setProperty('--progress',(a.duration?a.currentTime/a.duration:0)*100+'%');if(time)time.textContent=voiceTime(Math.max(0,(a.duration||0)-a.currentTime));},true);

document.addEventListener('ended',e=>{if(e.target.matches('.voice-audio')){const box=e.target.closest('.voice-player');box?.querySelector('.voice-play')?.classList.remove('is-playing');if(box?.querySelector('.voice-play'))box.querySelector('.voice-play').textContent='▶';const wave=box?.querySelector('.voice-wave'),time=box?.querySelector('time');if(wave)wave.style.setProperty('--progress','0%');if(time)time.textContent=voiceTime(e.target.duration||0);}},true);

async function startVoiceMessage(){

 if(VoiceUI.recorder||VoiceUI.rtc||VoiceUI.ai)throw Error('請先結束目前的錄音或通話');if(!chatId)return;const id=chatId;

 VoiceUI.recorder=await pcmRecorder();VoiceUI.recorder.chat=id;voicePanel('<strong>正在錄音… <span id="voiceElapsed">0:00</span></strong><p class="help">最多 120 秒；傳送前會平衡音量。只有按傳送才送出。</p><div class="flex"><button class="pill" data-action="cancelVoice">取消</button><button class="pill primary" data-action="finishVoice">完成錄音</button></div>');

 VoiceUI.recorder.timer=setInterval(()=>{const r=VoiceUI.recorder;if(!r)return;const n=(Date.now()-r.started)/1000;const el=document.getElementById('voiceElapsed');if(el)el.textContent=voiceTime(n);if(n>=119)actions.finishVoice().catch(e=>toast(e.message));},250);

}

actions.recordVoice=startVoiceMessage;

actions.cancelVoice=async()=>{const r=VoiceUI.recorder;VoiceUI.recorder=null;if(r){clearInterval(r.timer);await r.stop(true);}VoiceUI.preview=null;closeVoicePanel();};

actions.finishVoice=async()=>{const r=VoiceUI.recorder;if(!r)return;VoiceUI.recorder=null;clearInterval(r.timer);const a=await r.stop();if(!a||a.duration<.15){closeVoicePanel();toast('錄音太短，請重錄');return;}VoiceUI.preview={chat:r.chat,audio:a};voicePanel('<strong>語音預覽</strong>'+voiceHtml(a)+'<div class="flex"><button class="pill" data-action="cancelVoice">刪除</button><button class="pill primary" data-action="sendVoice">傳送語音</button></div><p id="voiceSendError" class="voice-error"></p>');};

actions.sendVoice=async()=>{const p=VoiceUI.preview;if(!p||p.busy)return;p.busy=true;try{const id=p.chat;let r;if(id.startsWith('human:'))r=await call('human',{action:'send',id:id.slice(6),text:'',audio:p.audio,images:[],clientMessageId:p.client||=(crypto.randomUUID())});else{voicePanel('<p>正在辨識語音，再交給 AI 回覆…</p>');if(!p.transcript)p.transcript=(await call('voiceTranscribe',{audio:p.audio})).text;r=await call('send',{id,retry:!!p.persisted,text:'［語音轉寫］'+p.transcript,audio:p.audio,images:[],clientMessageId:p.client||=(crypto.randomUUID())});}state=r.state;VoiceUI.preview=null;closeVoicePanel();render();}catch(e){if(!p.chat.startsWith('human:'))try{const latest=await call('load');p.persisted=!!latest.chats.find(c=>c.id===p.chat)?.messages.some(m=>m.clientMessageId===p.client);}catch{}voicePanel('<strong>語音待重試</strong>'+voiceHtml(p.audio)+'<p class="voice-error">'+esc(e.message)+'</p><div class="flex"><button class="pill" data-action="cancelVoice">刪除</button><button class="pill primary" data-action="sendVoice">重試傳送</button></div>');}finally{p.busy=false;}};

actions.voiceSettings=()=>{const s=state.settings;showModal('語音辨識設定',`<p class="help">AI 語音訊息與 AI 電話會將錄音送往此服務辨識，再由目前聊天模型按個性回覆。真人語音與真人通話不送往 AI。可使用 OpenAI 或相容的 /audio/transcriptions 服務。</p><label>語音 API 基底網址</label><input id="voiceUrl" value="${esc(s.voiceBaseUrl||'https://api.openai.com/v1')}"><label>辨識模型</label><input id="voiceModel" value="${esc(s.voiceModel||'whisper-1')}"><label>獨立語音金鑰</label><input id="voiceKey" type="password" placeholder="${s.voiceHasKey?'已保存；留白保留':'留白時沿用同網站的聊天金鑰'}"><p class="help">聊天服務若不支援語音辨識，需另外填可用服務與金鑰。可能另計語音辨識費用。</p><button class="pill primary" data-action="saveVoiceSettings">儲存語音設定</button>`);};

actions.saveVoiceSettings=async()=>{const key=$('#voiceKey').value.trim(),r=await call('voiceConfig',{url:$('#voiceUrl').value.trim(),model:$('#voiceModel').value.trim(),...(key?{key}:{})});state=r.state;closeModal();render();toast('語音設定已儲存');};

const apiBeforeVoice=apiPage;apiPage=function(){return apiBeforeVoice()+`<div class="card"><button class="setting-row" data-action="voiceSettings"><span class="setting-icon">${icon('mic')}</span><span class="label">語音與通話辨識</span><span class="chevron">›</span></button><p class="help">設定語音辨識服務、模型與獨立金鑰。錄製的 AI 語音與 AI 電話內容會傳送至此服務；真人語音不會傳給 AI 辨識。</p></div>`;};

const renderBeforeVoice=render;render=function(){renderBeforeVoice();const list=document.querySelector('.message-list');if(list){const human=isHumanChat(),messages=human?humanData().messages:state.chats.find(c=>c.id===chatId)?.messages||[];for(const m of messages){if(!m.audio)continue;const id=human?'human-'+m.id:m.id;const el=[...list.querySelectorAll('[data-message-id]')].find(n=>n.dataset.messageId===String(id));const bubble=el?.querySelector('.bubble');if(bubble&&!bubble.querySelector('.voice-player'))bubble.insertAdjacentHTML('beforeend',voiceHtml(m.audio));}}

 const composer=document.querySelector('.composer');composer?.insertAdjacentHTML('afterbegin','<button type="button" class="icon-button voice-button" data-action="recordVoice" aria-label="錄製語音訊息">'+icon('mic')+'</button>');if(isHumanChat())document.querySelector('.conversation .top .spacer')?.insertAdjacentHTML('afterend','<button class="icon-button" data-action="humanVoiceCall" aria-label="打給好友">'+icon('phone')+'</button>');};

let callOverlay;

function callScreen(name,status,buttons){if(!callOverlay){callOverlay=document.createElement('section');callOverlay.className='call-overlay';callOverlay.setAttribute('role','dialog');document.body.append(callOverlay);}callOverlay.innerHTML='<h2>'+esc(name)+'</h2><p class="status" id="voiceCallStatus">'+esc(status)+'</p><div class="flex">'+buttons+'</div>';}

function hideCall(){callOverlay?.remove();callOverlay=null;}

function queueAIChunk(a){const c=VoiceUI.ai;if(!c||!a||a.duration<.15)return;c.pending=c.pending.then(async()=>{try{const t=await call('voiceTranscribe',{audio:a});await call('voiceNote',{id:c.chat,text:t.text});c.count++;}catch(e){c.failed.push({audio:a,error:e.message});}});}

async function startAIVoiceCall(id){

 if(VoiceUI.ai||VoiceUI.rtc||VoiceUI.recorder)throw Error('請先結束目前的錄音或通話');const r=await mutate('newChat',{members:[id]});const target=r.chatId||state.chats.find(c=>c.members.length===1&&c.members[0]===id)?.id;if(!target)throw Error('找不到聊天室');closeModal();

 VoiceUI.ai={chat:target,ai:id,pending:Promise.resolve(),failed:[],count:0,ending:false};await aiCallStatus(target,'正在通話中');try{VoiceUI.ai.recorder=await pcmRecorder(queueAIChunk);callScreen(ai(id).name,'通話中，可以持續說話。\n每段語音辨識後保存，掛斷後 AI 才回覆。','<button class="pill hangup" data-action="endAIVoice">掛斷</button>');}catch(e){VoiceUI.ai=null;throw e;}

}

async function finishAIReply(){const c=VoiceUI.ai;if(!c)return;if(c.failed.length){callScreen(ai(c.ai).name,'通話已結束；有 '+c.failed.length+' 段未辨識，錄音暫留此畫面。\n'+c.failed[0].error,'<button class="pill" data-action="retryAIVoice">重試辨識</button><button class="pill" data-action="discardAIVoice">捨棄失敗片段</button>');return;}

 if(c.count){callScreen(ai(c.ai).name,'正在回覆剛才的通話內容…','');try{const r=await call('send',{id:c.chat,retry:true});state=r.state;}catch(e){callScreen(ai(c.ai).name,e.message,'<button class="pill" data-action="retryAIReply">重試回覆</button><button class="pill" data-action="closeAIVoice">返回聊天</button>');return;}}

 VoiceUI.ai=null;hideCall();await actions.manualRefresh();}

actions.endAIVoice=async()=>{const c=VoiceUI.ai;if(!c||c.ending)return;c.ending=true;await aiCallStatus(c.chat,'已結束通話');const a=await c.recorder.stop();queueAIChunk(a);callScreen(ai(c.ai).name,'通話已結束，正在整理語音…','');await c.pending;await finishAIReply();};

actions.retryAIVoice=async()=>{const c=VoiceUI.ai;if(!c)return;const failed=c.failed.splice(0);for(const f of failed)queueAIChunk(f.audio);callScreen(ai(c.ai).name,'正在重試辨識…','');await c.pending;await finishAIReply();};

actions.discardAIVoice=()=>confirmModal('捨棄未辨識語音','這些片段尚未轉為文字，捨棄後 AI 無法知道其內容。',async()=>{VoiceUI.ai.failed=[];closeModal();await finishAIReply();});

actions.retryAIReply=finishAIReply;actions.closeAIVoice=()=>{VoiceUI.ai=null;hideCall();actions.manualRefresh();};

async function rtcRequest(path,body){return call('human',{action:'rtc',path:'/v1/calls/'+path,...(body===undefined?{}:{body})});}

async function humanCallStatus(peer,status,callId,phase='ended'){try{await call('human',{action:'send',id:peer,text:status,callEvent:true,clientMessageId:'call-'+callId+'-'+phase});}catch(e){console.warn('通話狀態訊息未送出',e);}}

async function aiCallStatus(chat,status){await W.edit(s=>{const c=s.chats.find(x=>x.id===chat);if(c)W.append(c,'system',status,{callEvent:true});});}

async function nativeCall(command,extra={}){const creds=await call('rtcCredentials');if(!creds.token)throw Error('請先登入人類帳號');window.webkit.messageHandlers.mushuiCall.postMessage({command,...creds,...extra,names:Object.fromEntries(humanData().friends.map(p=>[p.id,p.name]))});}

async function buildPeer(){

 const stream=await openMicrophone(),config=await rtcRequest('config'),hasTurn=!!config.hasTurn;delete config.hasTurn;await call('voiceSession',{active:true});const pc=new RTCPeerConnection(config);const c={pc,stream,id:'',peer:'',candidates:[],remoteCandidates:[],connected:false,ended:false,hasTurn};VoiceUI.rtc=c;stream.getTracks().forEach(t=>pc.addTrack(t,stream));

 pc.onicecandidate=e=>{if(!e.candidate)return;const candidate=e.candidate.toJSON();if(c.id)rtcRequest('ice',{id:c.id,candidate}).catch(()=>{});else c.candidates.push(candidate);};

 pc.ontrack=e=>{const audio=new Audio();audio.hidden=true;document.body.append(audio);audio.autoplay=true;audio.volume=.85;audio.srcObject=e.streams[0]||new MediaStream([e.track]);VoiceUI.remoteAudio=audio;audio.play().catch(()=>{const s=document.getElementById('voiceCallStatus');if(s)s.textContent='請點啟用聲音';});};

 pc.onconnectionstatechange=()=>{if(VoiceUI.rtc!==c)return;if(pc.connectionState==='connected'){c.connected=true;if(!c.startedEvent){c.startedEvent=true;if(c.isCaller!==false)humanCallStatus(c.peer,'正在通話中',c.eventId||c.id,'active');}const el=document.getElementById('voiceCallStatus');if(el)el.textContent='通話中';}if(pc.connectionState==='failed'&&!c.failedNotice){c.failedNotice=true;const hint=c.hasTurn?'通話媒體連線失敗，請確認雙方網路與麥克風權限。':'跨裝置通話連線失敗：伺服器尚未配置 TURN 中繼。請在好友伺服器設定 MUSHUI_TURN_URLS 與 MUSHUI_TURN_SECRET，並使用支援 UDP 的 TURN 服務。';toast(hint);actions.endHumanCall().catch(()=>{});}if(pc.connectionState==='closed'&&!c.ended)actions.endHumanCall().catch(()=>{});};

 return c;

}

async function flushICE(c){for(const candidate of c.candidates.splice(0))await rtcRequest('ice',{id:c.id,candidate});}

async function remoteSDP(c,sdp){await c.pc.setRemoteDescription(sdp);for(const ice of c.remoteCandidates.splice(0))await c.pc.addIceCandidate(ice);}

actions.humanVoiceCall=async()=>{if(!isHumanChat())return;const peer=chatId.slice(6),friend=humanFriend(peer),eventId=crypto.randomUUID();if(VoiceUI.rtc||VoiceUI.ai||VoiceUI.recorder)throw Error('請先結束目前的錄音或通話');if(window.webkit?.messageHandlers?.mushuiCall){VoiceUI.nativeCall={peer,id:eventId,ended:false};VoiceUI.nativeCallConnected=false;await humanCallStatus(peer,'正在呼叫 '+friend.name,eventId,'ringing');try{await nativeCall('start',{peer,name:friend.name});}catch(e){VoiceUI.nativeCall.ended=true;VoiceUI.nativeCallConnected=false;await humanCallStatus(peer,'通話連線失敗：'+e.message,eventId,'ended');VoiceUI.nativeCall=null;throw e;}return;}let c;try{c=await buildPeer();c.peer=peer;c.eventId=eventId;c.isCaller=true;await humanCallStatus(peer,'正在呼叫 '+friend.name,eventId,'ringing');const offer=await c.pc.createOffer();await c.pc.setLocalDescription(offer);const r=await rtcRequest('start',{to:peer,offer:{type:offer.type,sdp:offer.sdp}});c.id=r.id;await flushICE(c);callScreen(friend.name,'等待對方接聽…','<button class="pill" data-action="unmuteRemote">啟用聲音</button><button class="pill hangup" data-action="endHumanCall">掛斷</button>');}catch(e){if(c?.id)try{await rtcRequest('end',{id:c.id});}catch{}if(c?.eventId)await humanCallStatus(peer,'通話連線失敗：'+e.message,eventId,'ended');await cleanupPeer();throw e;}};

async function cleanupPeer(){const c=VoiceUI.rtc;VoiceUI.rtc=null;if(c){c.ended=true;c.pc?.close();c.stream?.getTracks().forEach(t=>t.stop());}if(VoiceUI.remoteAudio){VoiceUI.remoteAudio.pause();VoiceUI.remoteAudio.srcObject=null;VoiceUI.remoteAudio.remove();VoiceUI.remoteAudio=null;}await call('voiceSession',{active:false}).catch(()=>{});hideCall();}

actions.endHumanCall=async()=>{const c=VoiceUI.rtc;if(c?.id){if(c.isCaller!==false)humanCallStatus(c.peer,'已結束通話',c.eventId||c.id,'ended');try{await rtcRequest('end',{id:c.id});}catch{}}await cleanupPeer();};

actions.answerHumanCall=async()=>{const old=VoiceUI.rtc;if(!old?.offer)return;VoiceUI.rtc=null;let c;try{c=await buildPeer();c.peer=old.peer;c.id=old.id;c.isCaller=false;c.remoteCandidates=old.remoteCandidates||[];await remoteSDP(c,old.offer);const answer=await c.pc.createAnswer();await c.pc.setLocalDescription(answer);await rtcRequest('answer',{id:c.id,answer:{type:answer.type,sdp:answer.sdp}});await flushICE(c);callScreen(humanFriend(c.peer).name,'正在連線…','<button class="pill" data-action="unmuteRemote">啟用聲音</button><button class="pill hangup" data-action="endHumanCall">掛斷</button>');}catch(e){if(c)await actions.endHumanCall();else{VoiceUI.rtc=old;await actions.endHumanCall();}throw e;}};

actions.unmuteRemote=()=>VoiceUI.remoteAudio?.play();

async function pollCalls(){if(VoiceUI.polling||!state||!humanData().connected||window.webkit?.messageHandlers?.mushuiCall)return;VoiceUI.polling=true;try{const r=await rtcRequest('poll?since='+VoiceUI.signalCursor);for(const e of r.events){VoiceUI.signalCursor=Math.max(VoiceUI.signalCursor,e.id);let c=VoiceUI.rtc;const current=r.calls.find(v=>v.id===e.callid);if(!current||!['ringing','active'].includes(current.status))continue;

 if(e.kind==='offer'){if(c?.id===e.callid)continue;if(c||VoiceUI.ai||VoiceUI.recorder){await rtcRequest('end',{id:e.callid});continue;}VoiceUI.rtc={id:e.callid,peer:e.sender,offer:e.payload,remoteCandidates:[],isCaller:false};window.mushuiMobileNotice?.({title:'好友來電 · '+humanFriend(e.sender).name,body:'語音通話邀請，點通知返回沐水',sticky:true,tag:'call-'+e.sender});window.mushui171StartRing?.();callScreen(humanFriend(e.sender).name,'好友語音來電','<button class="pill" data-action="answerHumanCall">接聽</button><button class="pill hangup" data-action="endHumanCall">拒接</button>');}

 else if(c?.id===e.callid&&e.kind==='answer')await remoteSDP(c,e.payload);

 else if(c?.id===e.callid&&e.kind==='ice'){if(c.pc?.remoteDescription)await c.pc.addIceCandidate(e.payload);else c.remoteCandidates.push(e.payload);}}

 const c=VoiceUI.rtc;if(c?.id){const active=r.calls.find(v=>v.id===c.id);if(active&&!['ringing','active'].includes(active.status)){if(c.isCaller!==false&&active.status!=='missed')humanCallStatus(c.peer,'已結束通話',c.eventId||c.id,'ended');await cleanupPeer();}}

 }catch(e){if(VoiceUI.rtc){const el=document.getElementById('voiceCallStatus');if(el)el.textContent='通話連線狀態：'+e.message;}}finally{VoiceUI.polling=false;}}

setInterval(()=>pollCalls(),1500);

let nativeCredentialSignature='';

setInterval(async()=>{if(!window.webkit?.messageHandlers?.mushuiCall||!state)return;try{const d=await call('rtcCredentials'),signature=JSON.stringify(d);if(signature!==nativeCredentialSignature){nativeCredentialSignature=signature;window.webkit.messageHandlers.mushuiCall.postMessage({command:'configure',...d});}}catch{}},12000);

window.mushuiNativeCallEvent=function(event){const c=VoiceUI.nativeCall;if(['ended','failed','disconnected','error'].includes(event.status)){VoiceUI.nativeCallConnected=false;window.mushui171Sound?.('callEnd');if(c&&!c.ended){c.ended=true;humanCallStatus(c.peer,event.status==='ended'?'已結束通話':'通話連線失敗',c.id,'ended');VoiceUI.nativeCall=null;}hideCall();return;}if(['connected','active','通話中'].includes(event.status)){VoiceUI.nativeCallConnected=true;window.mushui171Sound?.('callConnected');if(c&&!c.started){c.started=true;humanCallStatus(c.peer,'正在通話中',c.id,'active');}}callScreen(event.name||'好友通話',event.message||event.status,'<button class="pill hangup" data-action="endNativeCall">掛斷</button>');};

actions.endNativeCall=async()=>{VoiceUI.nativeCallConnected=false;const c=VoiceUI.nativeCall;if(c&&!c.ended){c.ended=true;await humanCallStatus(c.peer,'已結束通話',c.id,'ended');VoiceUI.nativeCall=null;}return nativeCall('end');};

window.addEventListener('pagehide',()=>{VoiceUI.recorder?.stop(true);const c=VoiceUI.rtc;if(c?.id)rtcRequest('end',{id:c.id}).catch(()=>{});cleanupPeer();});

if(state)render();



