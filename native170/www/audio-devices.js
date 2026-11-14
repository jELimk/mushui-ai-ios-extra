'use strict';
// Settings → 裝置: which microphone and which output the app uses.
// Windows picks real devices for everything the app plays. Phones only let an app choose the route of a call,
// so they offer auto, speaker and earpiece; each phone remembers its own choice, because device ids mean nothing elsewhere.
(()=>{
 const computer=!!window.MushuiDesktop,phone=!computer;
 const saved=key=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
 const remember=(key,value)=>{try{value?localStorage.setItem(key,value):localStorage.removeItem(key);}catch{}};
 const computerConfig=()=>typeof deviceConfig==='function'?deviceConfig():{};
 const chosen=()=>computer?computerConfig():{input:saved('mzAudioInput'),output:saved('mzAudioRoute')};
 let devices=[],read=false;

 window.mzAudioInput=()=>phone?saved('mzAudioInput'):'';
 window.mzNoiseOn=()=>saved('mzNoise')!=='off';
 window.mzAudioRoute=()=>phone?saved('mzAudioRoute'):'';

 const usable=kind=>devices.filter(d=>d.kind===kind&&d.deviceId&&d.deviceId!=='default'&&d.deviceId!=='communications');
 function options(kind,current,name){const list=usable(kind),missing=current&&!list.some(d=>d.deviceId===current);return `<option value="">${mzT('系統預設','System default')}</option>`+list.map((d,i)=>`<option value="${esc(d.deviceId)}" ${d.deviceId===current?'selected':''}>${esc(d.label||name+' '+(i+1))}</option>`).join('')+(missing?`<option value="${esc(current)}" selected>${mzT('已選裝置（目前未連接）','Selected device (not connected)')}</option>`:'');}
 function inputOptions(){return options('audioinput',chosen().input,mzT('麥克風','Microphone'));}
 function outputOptions(){if(computer)return options('audiooutput',chosen().output,mzT('輸出裝置','Output'));const route=chosen().output;return [['',mzT('自動（有耳機時用耳機）','Auto (headphones when connected)')],['speaker',mzT('喇叭','Speaker')],['earpiece',mzT('聽筒','Earpiece')]].map(([id,label])=>`<option value="${id}" ${id===route?'selected':''}>${label}</option>`).join('');}

 async function readDevices(){if(!navigator.mediaDevices?.enumerateDevices)return;devices=await navigator.mediaDevices.enumerateDevices().catch(()=>[]);read=true;const input=document.getElementById('mzAudioIn'),output=document.getElementById('mzAudioOut');if(input)input.innerHTML=inputOptions();if(output)output.innerHTML=outputOptions();}

 const noiseSwitch=style=>`<label class="${style} mz-noise"><span>${mzT('降噪','Noise suppression')}</span><input type="checkbox" data-mz-noise ${window.mzNoiseOn()?'checked':''}></label>`;
 window.mzNoiseSwitch=()=>noiseSwitch('mz-ai-volume');

 window.mzAudioCard=()=>{if(!read)setTimeout(readDevices);return `<div class="card"><h3>${mzT('聲音輸入與輸出','Audio input and output')}</h3><label for="mzAudioIn">${mzT('輸入（麥克風）','Input (microphone)')}</label><select id="mzAudioIn">${inputOptions()}</select><label for="mzAudioOut">${computer?mzT('輸出（喇叭／耳機）','Output (speakers / headphones)'):mzT('通話輸出','Call output')}</label><select id="mzAudioOut">${outputOptions()}</select><p class="small">${computer?mzT('會套用到 App 內的聲音和進行中的通話。','Applies to sound in the app and to a call in progress.'):mzT('下一通電話開始生效。語音訊息和音樂的輸出由手機系統決定。','Applies from your next call. Your phone decides where voice messages and music play.')}</p><button class="pill" data-action="mzAudioRefresh">${mzT('重新讀取裝置','Find devices again')}</button>${noiseSwitch('check-row')}<p class="small">${mzT('通話時濾掉環境雜音。想傳出原本的聲音（唱歌、放音樂）時關閉。通話中也能切換。','Filters out background noise on calls. Turn it off to send your natural sound, such as singing or music. You can also switch it during a call.')}</p></div>`;};

 // Device names stay hidden until the microphone has been allowed once, so asking for it is what fills the list.
 actions.mzAudioRefresh=async()=>{const stream=await openMicrophone();stream.getTracks().forEach(t=>t.stop());await readDevices();toast(mzT('已更新裝置清單','Device list updated'));};

 async function save(){const input=document.getElementById('mzAudioIn')?.value||'',output=document.getElementById('mzAudioOut')?.value||'';if(computer){const previous=computerConfig();await applyDesktopDevices(previous,{...previous,input,output});}else{remember('mzAudioInput',input);remember('mzAudioRoute',output);if(window.IOSHost)await Desktop.invoke('callOutput',{route:output}).catch(()=>{});}toast(mzT('已儲存','Saved'));}
 document.addEventListener('change',e=>{if(e.target.id==='mzAudioIn'||e.target.id==='mzAudioOut')save().catch(err=>toast(err.message));});
 navigator.mediaDevices?.addEventListener?.('devicechange',readDevices);

 // Browsers fix noise suppression when a microphone opens, so switching it mid-call means opening the microphone again
 // and handing the new one to whatever the call is sending. The other side hears no break beyond a brief click.
 const stop=stream=>stream?.getTracks().forEach(t=>t.stop());
 async function freshMic(muted){const stream=await openMicrophone();stream.getAudioTracks().forEach(t=>t.enabled=!muted);return stream;}
 async function send(pc,stream){const track=stream.getAudioTracks()[0];for(const sender of pc.getSenders())if(sender.track?.kind==='audio')await sender.replaceTrack(track);}
 window.mzRefreshCallMic=async()=>{
  const human=VoiceUI.rtc,group=VoiceUI.groupCall,live=typeof liveVoice!=='undefined'&&liveVoice?.liveSession?liveVoice:null;
  if(human?.mix){const stream=await freshMic(human.muted);if(VoiceUI.rtc!==human)return stop(stream);const source=human.mix.ctx.createMediaStreamSource(stream);source.connect(human.mix.micGain||human.mix.destination);human.mix.micSource.disconnect();stop(human.stream);human.stream=stream;human.mix.micSource=source;}
  if(group){const stream=await freshMic(group.muted);if(VoiceUI.groupCall!==group)return stop(stream);for(const peer of group.peers.values())await send(peer.pc,stream);if(group.mix){const mine=group.mix.ctx.createMediaStreamSource(stream);mine.connect(group.mix.destination);group.mix.mine.disconnect();group.mix.mine=mine;}stop(group.stream);group.stream=stream;}
  if(live){const stream=await freshMic(false);if(liveVoice!==live)return stop(stream);await send(live.pc,stream);stop(live.media);live.media=stream;}
 };
 async function setNoise(on){remember('mzNoise',on?'':'off');document.querySelectorAll('[data-mz-noise]').forEach(x=>x.checked=on);if(window.IOSHost)await Desktop.invoke('callNoise',{on}).catch(()=>{});await window.mzRefreshCallMic();toast(on?mzT('降噪已開啟','Noise suppression on'):mzT('降噪已關閉','Noise suppression off'));}
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-mz-noise]'))setNoise(e.target.checked).catch(err=>toast(err.message));});
 const plainScreen=callScreen;callScreen=function(...args){const result=plainScreen.apply(this,args),live=typeof liveVoice!=='undefined'&&liveVoice?.liveSession;if(callOverlay&&(VoiceUI.rtc||live)&&!callOverlay.querySelector('.mz-noise'))(callOverlay.querySelector('.mz-call-volumes')||callOverlay).insertAdjacentHTML('beforeend',window.mzNoiseSwitch());return result;};

 // A route the person picked also applies to AI and group calls, which otherwise leave Android's audio untouched.
 if(window.AndroidHost){const plainCall=call;call=async function(op,data){const result=await plainCall(op,data),route=saved('mzAudioRoute');if(op==='voiceSession'&&route)await Desktop.invoke('callAudio',{active:!!data?.active,speaker:route==='speaker'}).catch(()=>{});return result;};}

 // Windows: sounds that never enter the page (previews, notification sounds, AI speech) follow the chosen output too.
 if(computer){
  const output=()=>computerConfig().output||'';
  const Context=window.AudioContext;if(Context)window.AudioContext=class extends Context{constructor(...args){super(...args);const id=output();if(id&&this.setSinkId)this.setSinkId(id).catch(()=>{});}};
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const id=output();if(!id||!this.setSinkId||this.sinkId===id)return play.call(this);return this.setSinkId(id).catch(()=>{}).then(()=>play.call(this));};
 }
})();
