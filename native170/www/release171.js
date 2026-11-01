/* 1.7.1 shared release features. */

'use strict';

{

const W=window.WebEngine;

if(!W)throw Error('沐水儲存引擎尚未載入');

Object.assign(featureDefaults,{redPackets:true});

function secureRandomBelow(max){const range=0x100000000,limit=Math.floor(range/max)*max,word=new Uint32Array(1);let n;do{crypto.getRandomValues(word);n=word[0];}while(n>=limit);return n%max;}

const oldMigrate=W.migrate;

W.migrate=s=>{s=oldMigrate(s);if(!Number.isFinite(s.settings.mushuiCoins))s.settings.mushuiCoins=1000;if(!Number.isFinite(s.settings.coinClaimAt))s.settings.coinClaimAt=0;for(const a of s.ais){if(!Number.isFinite(a.affinity))a.affinity=0;}return s;};

pageNames.coins='沐水幣與提示音';

const oldSettingsPage=settingsPage;

settingsPage=()=>page==='coins'?`<header class="top"><div class="between"><div class="flex">${btn('back','back','返回')}<h2>${pageNames.coins}</h2></div></div></header><div class="content">${coinSoundPage()}</div>`:oldSettingsPage();

const oldSettingsView=settingsView;

settingsView=()=>oldSettingsView().replace(settingRow('backup','cloud','備份與還原','JSON'),settingRow('backup','cloud','備份與還原','JSON')+settingRow('coins','gift','沐水幣與提示音',Math.floor(state.settings.mushuiCoins)+' 枚'));

const priorProxy=W.proxy;W.proxy=async(...args)=>{try{return await priorProxy(...args);}catch(e){if(e.status===401){e.rawMessage=e.rawMessage||e.message;e.message='API HTTP 401：服務拒絕認證。請在這台裝置的「設定 → API」確認 API 金鑰、服務網址與模型；API 金鑰不會隨帳號同步。';}throw e;}};



let soundCfg={enabled:{},custom:{}};

W.get('mushui-ui-sounds').then(v=>{if(v&&typeof v==='object')soundCfg={...soundCfg,...v,enabled:{...soundCfg.enabled,...v.enabled},custom:{...soundCfg.custom,...v.custom}};}).catch(()=>{});

const soundEvents=[['notice','新訊息通知'],['ringtone','電話鈴聲'],['callConnected','通話接通'],['callEnd','結束通話'],['screenOn','開始分享畫面'],['screenOff','停止分享畫面'],['videoOn','開啟視訊'],['videoOff','關閉視訊'],['mute','閉麥'],['unmute','開啟麥克風']];

// 設定 → 提示音 shows only sound settings; the wallet and daily claim live in 我 → 沐水幣.
function coinSoundPage(){return `<h3 class="section-label">通知與通話提示音</h3><p class="help">預設提示音為沐水原創合成音，可逐項關閉或上傳你有權使用的短音檔（WAV、MP3、M4A；最多 5 MB、10 秒）。</p><section class="card sound-settings">${soundEvents.map(([key,label])=>`<div class="sound-setting"><div><strong>${label}</strong><small>${soundCfg.custom[key]?'已使用自訂音效':'沐水原創提示音'}</small></div><label class="sound-switch"><input type="checkbox" data-sound-enabled="${key}" ${soundCfg.enabled[key]===false?'':'checked'}><span></span></label><button class="pill" data-preview-sound="${key}">試聽</button><button class="link-button" data-upload-sound="${key}">上傳</button>${soundCfg.custom[key]?`<button class="link-button danger" data-clear-sound="${key}">移除</button>`:''}</div>`).join('')}</section><p class="feature-note">UNDERTALE／DELTARUNE 原聲與音效不會隨 App 重新散佈；可匯入你有權使用的音檔。</p>`;}

let ringtoneTimer=0;window.mushui171StartRing=()=>{window.mushui171StopRing();window.mushui171Sound('ringtone');ringtoneTimer=setInterval(()=>window.mushui171Sound('ringtone'),2200);};window.mushui171StopRing=()=>{clearInterval(ringtoneTimer);ringtoneTimer=0;};

let soundContext=null,soundQueue=Promise.resolve();async function originalSound(kind){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;try{soundContext||=new C();if(soundContext.state!=='running')await soundContext.resume();const patterns={notice:[[784,0],[1046,.11]],ringtone:[[659,0],[784,.18],[988,.46],[784,.64]],callConnected:[[784,0],[988,.1]],callEnd:[[988,0],[659,.12]],screenOn:[[660,0],[880,.09]],screenOff:[[880,0],[660,.12]],videoOn:[[587,0],[784,.11]],videoOff:[[784,0],[587,.11]],mute:[[392,0]],unmute:[[587,0]]},seq=patterns[kind]||patterns.notice;for(const [hz,at] of seq){const o=soundContext.createOscillator(),g=soundContext.createGain(),t=soundContext.currentTime+at;o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.075,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g).connect(soundContext.destination);o.start(t);o.stop(t+.2);}await new Promise(r=>setTimeout(r,Math.max(320,(seq.at(-1)?.[1]||0)*1000+240)));}catch(e){console.warn('音效無法播放',e);}}

async function playQueuedSound(kind){if(soundCfg.enabled[kind]===false)return;try{const raw=soundCfg.custom[kind];if(raw){await new Promise((resolve,reject)=>{const audio=new Audio(raw),timeout=setTimeout(resolve,10000);audio.volume=.42;audio.onended=()=>{clearTimeout(timeout);resolve();};audio.onerror=()=>{clearTimeout(timeout);reject(Error('自訂音效播放失敗'));};audio.play().catch(reject);});}else await originalSound(kind);}catch(e){console.warn('切回沐水提示音',e);await originalSound(kind);}}

window.mushui171Sound=kind=>{soundQueue=soundQueue.catch(()=>{}).then(()=>playQueuedSound(kind));return soundQueue;};document.addEventListener('pointerdown',()=>{if(soundContext?.state==='suspended')soundContext.resume().catch(()=>{});},{capture:true});window.addEventListener('pageshow',()=>{if(soundContext?.state==='suspended')soundContext.resume().catch(()=>{});});

window.mushuiMobileNotice=details=>{if(!(window.AndroidHost||window.MushuiNativeIOS)||!window.Desktop?.invoke)return Promise.resolve(false);return Desktop.invoke('notify',details).catch(()=>false);};

async function saveSoundCfg(){await W.put('mushui-ui-sounds',soundCfg);}

actions.claimDailyCoins=async()=>{const s=await W.read();if(Date.now()-s.settings.coinClaimAt<86400000)throw Error('每日零用幣已領取');await W.edit(s=>{s.settings.mushuiCoins+=1000;s.settings.coinClaimAt=Date.now();});state=await W.view();render();toast('已領取 1,000 枚沐水幣');};

actions.previewSound=async key=>{await window.mushui171Sound(key);};

document.addEventListener('change',e=>{const key=e.target.dataset.soundEnabled;if(key){soundCfg.enabled[key]=e.target.checked;saveSoundCfg().then(()=>toast('提示音設定已更新',1000));}});

document.addEventListener('click',e=>{const b=e.target.closest('[data-preview-sound],[data-upload-sound],[data-clear-sound]');if(!b)return;const key=b.dataset.previewSound||b.dataset.uploadSound||b.dataset.clearSound;if(b.dataset.previewSound){window.mushui171Sound(key);return;}if(b.dataset.clearSound){delete soundCfg.custom[key];saveSoundCfg().then(render);return;}const input=document.createElement('input');input.type='file';input.accept='audio/wav,audio/mpeg,audio/mp4,audio/x-m4a';input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024)throw Error('音效檔最多 5 MB');const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('此裝置無法檢查音效格式');const ctx=new C();try{const decoded=await ctx.decodeAudioData(await file.arrayBuffer());if(decoded.duration>10)throw Error('音效需在 10 秒內');}finally{await ctx.close();}soundCfg.custom[key]=url;await saveSoundCfg();render();toast('音效已套用');}catch(err){modalError(err);}};input.click();});



W.canonicalCard=c=>{if(!c||!['transfer','gift','redpacket'].includes(c.type))return null;const result={type:c.type,status:'pending',note:W.clean(c.note,300)};if(c.type==='gift')return c.title?.trim()?{...result,title:W.clean(c.title,120)}:null;const amount=Number(c.amount);return amount>0&&amount<=999999.99?{...result,amount:amount.toFixed(2),currency:'沐水幣'}:null;};

const priorSystem=W.system;W.system=a=>priorSystem(a)+'\n沐水幣好感值：'+Math.round(a.affinity||0)+'。角色可依個性贈送虛擬沐水幣、虛擬紅包或虛擬禮物；紅包可為 {type:redpacket,amount:數字,note:附言}。金幣僅是 App 內互動，沒有真實價值。';

const priorSend=W.send;W.send=async d=>{

 const card=d.virtualCard,amount=card&&card.type!=='gift'?Number(card.amount):0;

 if(amount>0&&(await W.read()).settings.mushuiCoins<amount)throw Error('沐水幣不足；可到設定領取每日零用幣。');

 const priorCount=(await W.read()).chats.find(c=>c.id===d.id)?.messages.length||0;

 const result=await priorSend(d);

 if(card){await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id),m=c?.messages.find(m=>m.clientMessageId===d.clientMessageId);if(m){const saved=m.virtualCard;if(amount>0)s.settings.mushuiCoins=Math.max(0,s.settings.mushuiCoins-amount);if(c.members.length){const a=s.ais.find(a=>a.id===c.members[0]);if(a)a.affinity=(a.affinity||0)+(card.type==='gift'?5:Math.max(1,Math.round(amount/20)));}if(saved){if(saved.type==='redpacket'){const winner=secureRandomBelow(2)===0?'me':c.members[0],won=Math.max(1,secureRandomBelow(Math.max(1,Math.round(amount*100)))+1);saved.status='claimed';saved.winner=winner;saved.winnerName=winner==='me'?'我':s.ais.find(a=>a.id===winner)?.name||'AI';saved.claimedAmount=(won/100).toFixed(2);if(winner==='me')s.settings.mushuiCoins+=won/100;else{const a=s.ais.find(a=>a.id===winner);if(a)a.affinity=(a.affinity||0)+1;}}else saved.status='accepted';}}});}

 await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id);if(!c)return;const m=c.messages.find(m=>m.clientMessageId===d.clientMessageId);if(m)m.readBy=[...c.members];});

 const after=(await W.read()).chats.find(c=>c.id===d.id);if(after&&after.messages.length>priorCount)window.mushui171Sound('notice');

 return {...result,state:await W.view()};

};

const priorHuman=W.human;W.human=async d=>{

 if(d.action==='markRead'){const peer=String(d.peer||'').replace(/^human:/,''),r=await W.humanRequest('/v1/messages/read',{peer});await W.edit(s=>{const me=s.human.me.id;for(const m of s.human.messages)if(m.sender===peer&&m.recipient===me&&!m.readAt)m.readAt=r.readAt||Date.now();});return{state:await W.view()};}

 const card=d.action==='send'?d.virtualCard:null,amount=card&&card.type!=='gift'?Number(card.amount):0;

 let unlimited=false;if(card&&window.MizukiStaffEdition){const role=await W.humanRequest('/v1/support');if(!role.staff)throw Error('此帳號未獲授權為官方客服');unlimited=true;window.MizukiVerifiedStaff=true;}

 if(amount>0&&!unlimited&&(await W.read()).settings.mushuiCoins<amount)throw Error('沐水幣不足；可到設定領取每日零用幣。');

 const result=await priorHuman(d);

 if(card&&amount>0&&!unlimited){await W.edit(s=>{s.settings.mushuiCoins=Math.max(0,s.settings.mushuiCoins-amount);});result.state=await W.view();}

 return result;

};

const syncHuman=W.humanSync;let incomingSeen=new Set(),incomingOwner='',incomingBaseline=0;W.humanSync=async()=>{const before=await W.read(),ownerKey=before.human.serverUrl+'|'+before.human.me.id;if(ownerKey!==incomingOwner){incomingOwner=ownerKey;incomingSeen=new Set(before.human.messages.map(m=>String(m.id)));incomingBaseline=Number(before.human.lastSync)||Date.now();}await syncHuman();const s=await W.read();for(const m of s.human.messages){const id=String(m.id),isIncoming=m.sender!==s.human.me.id&&m.recipient===s.human.me.id;if(!incomingSeen.has(id)&&isIncoming&&Number(m.time||0)>=incomingBaseline){if(m.callEvent){const tag='call-'+m.sender;if(/^已結束通話/.test(m.text||''))window.mushuiMobileNotice({clear:true,tag});else window.mushuiMobileNotice({title:'通話中 · '+(humanFriend(m.sender)?.name||'好友'),body:m.text||'通話進行中',sticky:true,tag});}else{window.mushui171Sound('notice');if(document.hidden||chatId!=='human:'+m.sender)window.mushuiMobileNotice({title:humanFriend(m.sender)?.name||'好友',body:m.text|| (m.images?.length?'傳來一張照片':'傳來一則訊息'),tag:'msg-'+id});}}incomingSeen.add(id);}incomingBaseline=Math.max(incomingBaseline,Number(s.human.lastSync)||Date.now());await W.edit(s=>{const me=s.human.me.id;s.settings.cardReceipts||={};for(const m of s.human.messages){const c=m.virtualCard;if(!c)continue;let credit=0;if(c.type==='transfer'&&c.status==='accepted'&&m.recipient===me)credit=Number(c.amount);else if(c.type==='transfer'&&c.status==='declined'&&m.sender===me)credit=Number(c.amount);else if(c.type==='redpacket'&&c.status==='claimed'&&c.winner===me)credit=Number(c.claimedAmount);const key=String(m.id)+':'+c.status+':'+(c.winner||'');if(credit>0&&!s.settings.cardReceipts[key]){s.settings.mushuiCoins+=credit;s.settings.cardReceipts[key]=Date.now();}}});};

const priorDispatch=W.dispatch;W.dispatch=async(op,d={})=>{

 if(op==='virtualCard'){

  if(String(d.id).startsWith('human:')){

   const peer=String(d.id).slice(6),r=await W.humanRequest('/v1/message-tools',{messageId:d.messageId,peer,action:'cardStatus',decline:!!d.decline});await W.humanSync();

   return{state:await W.view(),claim:r};

  }

  let claim={};await W.edit(s=>{const c=W.find(s.chats,d.id),m=W.find(c.messages,d.messageId),card=m.virtualCard;if(card?.status!=='pending')throw Error('卡片已處理');if(d.decline){card.status='declined';W.append(c,'me','已婉拒這份虛擬心意。');return;}if(m.author==='me')throw Error('這是你送出的卡片，不能領取');if(card.type==='redpacket'){

    const members=['me',...c.members],winner=members[secureRandomBelow(members.length)],total=Math.max(1,Math.round(Number(card.amount)*100)),won=secureRandomBelow(total)+1;card.status='claimed';card.winner=winner;card.winnerName=winner==='me'?'我':W.find(s.ais,winner)?.name||'AI';card.claimedAmount=(won/100).toFixed(2);claim={winner,winnerName:card.winnerName,claimedAmount:card.claimedAmount};

    if(winner==='me')s.settings.mushuiCoins+=won/100;else{const a=s.ais.find(a=>a.id===winner);if(a)a.affinity=(a.affinity||0)+1;}

    W.append(c,'me',winner==='me'?'我搶到了 '+card.claimedAmount+' 枚沐水幣！':W.find(s.ais,winner).name+' 搶到了紅包。');

   }else{card.status='accepted';if(card.type==='transfer')s.settings.mushuiCoins+=Number(card.amount);const a=s.ais.find(a=>a.id===m.author);if(a)a.affinity=(a.affinity||0)+(card.type==='gift'?5:Math.max(1,Math.round(Number(card.amount)/20)));W.append(c,'me',card.type==='gift'?'我收下這份心意了，謝謝你。':'我收下這筆沐水幣了，謝謝你。');}

  });return{state:await W.view(),claim};

 }

 return priorDispatch(op,d);

};

let readRequest='';let soundPoll=0;

// Mark a friend chat read once per newest unread message (never in a render loop).
let readMarked='';const priorRender=render;render=function(){priorRender();if(isHumanChat()&&humanData().connected){const h=humanData(),peer=chatId.slice(6),last=h.messages.filter(m=>m.sender===peer&&m.recipient===h.me.id&&!m.readAt).at(-1),key=last?peer+':'+last.id:'';if(last&&readRequest!==peer&&readMarked!==key){readRequest=peer;readMarked=key;call('human',{action:'markRead',peer}).then(r=>{state=r.state;readRequest='';render();}).catch(()=>{readRequest='';readMarked='';});}}

 if(!state)return;const rows=document.querySelectorAll('.message[data-message-id]');for(const row of rows){const id=row.dataset.messageId,m=isHumanChat()?humanData().messages.find(x=>String(x.id)===String(id).replace(/^human-/,'')):state.chats.find(c=>c.id===chatId)?.messages.find(x=>String(x.id)===String(id));if(!m)continue;const bubble=row.querySelector('.bubble'),card=m.virtualCard;if(card&&bubble&&!bubble.querySelector('.virtual-card'))bubble.insertAdjacentHTML('beforeend',virtualCardHtml(m));if(m.author==='me'&&row.querySelector('.stamp')&&!row.querySelector('.delivery-check')){const read=isHumanChat()?!!m.readAt:(m.readBy||[]).length>0,pending=!isHumanChat()&&sending.has(chatId)&&!read;row.querySelector('.stamp').insertAdjacentHTML('beforeend',` <span class="delivery-check ${read?'is-read':''} ${pending?'pending-check':''}" title="${pending?'正在傳送':read?'已讀':'已傳送'}">${read?'✓✓':'✓'}</span>`);}}

};

// Recorded voice clips remain persisted as playable audio attachments in the chat.

const voiceIdentity=actions.voiceIdentity;actions.voiceIdentity=()=>{voiceIdentity();const save=document.querySelector('.sheet [data-action="saveVoiceIdentity"]');if(save&&!document.querySelector('.sheet [data-action="previewVoice"]'))save.insertAdjacentHTML('beforebegin','<button class="pill" data-action="previewVoice">▶ 試聽目前音色</button>');};

actions.previewVoice=async()=>{const id=voiceEditingId;if(!id)return;const audio=await W.synthesize(id,'你好，這是我的聲音試聽。');const player=new Audio(audio.data);player.volume=.8;await player.play();};

const previousPoll=pollCalls;let ringingId='',outgoingRingId='';pollCalls=async()=>{await previousPoll();const c=VoiceUI.rtc;if(c?.offer&&c.id!==ringingId){ringingId=c.id;window.mushui171StartRing();}else if((!c?.offer||c.pc)&&ringingId){ringingId='';window.mushui171StopRing();}if(outgoingRingId){const active=outgoingRingId.startsWith('native:')?VoiceUI.nativeCallConnected:!!c&&c.id===outgoingRingId&&!c.pc?.remoteDescription;if(!active){outgoingRingId='';window.mushui171StopRing();}}};

const callStart=actions.humanVoiceCall;actions.humanVoiceCall=async(...args)=>{await callStart(...args);const c=VoiceUI.rtc;outgoingRingId=window.webkit?.messageHandlers?.mushuiCall?'native:'+chatId.slice(6):c?.id||'';if(outgoingRingId)window.mushui171StartRing();};

const callAnswer=actions.answerHumanCall;actions.answerHumanCall=async(...args)=>{const peer=VoiceUI.rtc?.peer;window.mushui171StopRing?.();if(peer)window.mushuiMobileNotice({clear:true,tag:'call-'+peer});return callAnswer(...args);};const callEnd=actions.endHumanCall;actions.endHumanCall=async(...args)=>{outgoingRingId='';const peer=VoiceUI.rtc?.peer;window.mushui171StopRing?.();window.mushui171Sound('callEnd');if(peer)window.mushuiMobileNotice({clear:true,tag:'call-'+peer});return callEnd(...args);};const nativeEnd=actions.endNativeCall;actions.endNativeCall=async(...args)=>{outgoingRingId='';window.mushui171StopRing?.();window.mushui171Sound('callEnd');return nativeEnd(...args);};

const nativeCallEvent=window.mushuiNativeCallEvent;window.mushuiNativeCallEvent=event=>{if(['connected','active','通話中','ended'].includes(event.status)){outgoingRingId='';window.mushui171StopRing?.();}if(nativeCallEvent)nativeCallEvent(event);};

function installMediaSoundHooks(){for(const [name,get,key] of [['desktopCamera',()=>!!VoiceUI.rtc?.cameraStream,()=>VoiceUI.rtc?.cameraStream?'videoOn':'videoOff'],['desktopMute',()=>!!VoiceUI.rtc?.muted,()=>VoiceUI.rtc?.muted?'mute':'unmute']]){const fn=actions[name];if(!fn||fn.mushui171Wrapped)continue;const wrapped=async(...args)=>{const was=get(),r=await fn(...args);if(get()!==was)window.mushui171Sound(key());return r;};wrapped.mushui171Wrapped=true;actions[name]=wrapped;}for(const name of ['startScreen','stopScreen']){const fn=window[name];if(typeof fn!=='function'||fn.mushui171Wrapped)continue;const wrapped=async(...args)=>{const was=!!VoiceUI.rtc?.screenStream,r=await fn(...args),now=!!VoiceUI.rtc?.screenStream;if(now!==was)window.mushui171Sound(now?'screenOn':'screenOff');return r;};wrapped.mushui171Wrapped=true;window[name]=wrapped;}}

installMediaSoundHooks();window.addEventListener('mushui-desktop-modules-ready',installMediaSoundHooks);

const baseCallOptions=chatOptions;chatOptions=function(){baseCallOptions();const modalEl=document.querySelector('.sheet');if(modalEl&&!modalEl.querySelector('[data-action="voiceIdentity"]'))modalEl.insertAdjacentHTML('beforeend','<button class="setting-choice" data-action="voiceIdentity">音色設定與試聽　›</button>');};

}

