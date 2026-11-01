 'use strict';

if(!window.MushuiDesktop){

 const W=WebEngine;

 const original=W.human;W.human=async d=>{const r=await original(d);if(['login','register'].includes(d.action)&&window.AndroidHost)Desktop.invoke('life',{start:true}).catch(()=>{});return r;};

 const beforeSettings=settingsView;settingsView=function(){return beforeSettings()+`<div class="content"><div class="card"><button class="setting-row" data-action="accountSync"><span class="setting-icon">${icon('cloud')}</span><span class="label">帳號與跨裝置同步</span><span>›</span></button></div></div>`;};

 actions.accountSync=()=>{const status=state.accountSync||{};showModal('帳號與跨裝置同步',`<p class="help">同一伺服器、ID 與密碼登入，手機與電腦開著時會交換 AI 訊息、角色、記憶、個人資料與朋友圈。訊息送出後立即觸發同步，不必等 AI 回覆；尚未送出的草稿不會同步。API 金鑰仍留在各裝置。關閉或系統暫停 Safari 時無法即時同步，重新開啟後補同步。</p><p class="help">${humanData().connected?'已登入 '+esc(humanData().me.id):'尚未登入'} · ${state.ais.length} 位 AI</p><p class="inline-error">${esc(status.error||'')}</p><button class="pill primary" data-action="humanAccount">登入／帳號</button><button class="pill" data-action="accountSyncNow">立即同步</button><button class="pill" data-action="importLegacyAccount">移入舊裝置 JSON</button>`);};

 actions.accountSyncNow=async()=>{await W.accountSync();state=await call('load');if(!dirty)draft=structuredClone(state.settings);actions.accountSync();};

 actions.importLegacyAccount=()=>confirmModal('合併舊裝置資料','選擇沐水 JSON 備份，保留登入與好友，不移入 API 金鑰或開啟自動活動。',async()=>{const r=await call('importAccountBackup');if(r.cancelled)return;state=r.state;draft=structuredClone(state.settings);closeModal();render();toast(r.synced?'資料已合併並同步':'已合併本機，請檢查同步狀態');});

 const humanCallBefore=humanCall;humanCall=async d=>{const r=await humanCallBefore(d);if(['login','register','logout'].includes(d.action)){draft=structuredClone(state.settings);dirty=false;}return r;};

 if(window.AndroidHost||window.IOSHost)W.notifications=async()=>{const r=await Desktop.invoke('notifications');await W.edit(s=>s.settings.desktopNotifications=!!r.granted);return r;};

}

let crossPollBusy=false,crossPollAgain=false;

async function refreshCrossDevice(){

 if(window.DesktopDetached||!state||document.hidden)return;

 if(crossPollBusy){crossPollAgain=true;return;}crossPollBusy=true;

 try{

  const next=await call('load'),listChanged=refreshSignature([state.chats,state.human.messages])!==refreshSignature([next.chats,next.human.messages]),prior=chatId.startsWith('human:')?{messages:state.human.messages,pins:state.human.messagePins}:state.chats.find(c=>c.id===chatId),after=chatId.startsWith('human:')?{messages:next.human.messages,pins:next.human.messagePins}:next.chats.find(c=>c.id===chatId);

  const visible=chatId&&refreshSignature(prior)!==refreshSignature(after),roster=refreshSignature(state.ais)!==refreshSignature(next.ais),profile=refreshSignature(state.settings)!==refreshSignature(next.settings);const people=refreshSignature([state.human.friends,state.human.requests,state.human.outgoing])!==refreshSignature([next.human.friends,next.human.requests,next.human.outgoing]),moments=refreshSignature(state.moments)!==refreshSignature(next.moments);

  const alias=next.syncMeta?.aliases?.[chatId];if(alias&&alias!==chatId){chatDrafts[alias]??=chatDrafts[chatId]||'';chatId=alias;}const priorRequestIds=window.__mzSeenRequests,nextRequestIds=(next.human?.requests||[]).map(r=>String(r.id));window.__mzSeenRequests=new Set(nextRequestIds);if(priorRequestIds&&nextRequestIds.some(id=>!priorRequestIds.has(id)))toast('有 '+nextRequestIds.length+' 條待認證的好友申請',2800);state=next;if(!dirty)draft=structuredClone(next.settings);

  if(!modal&&Date.now()>=(window.cardInteractionUntil||0)&&(!chatId||composerMenuOpen!==chatId)&&(visible||(listChanged&&(window.MushuiDesktop||(tab==='chats'&&!chatId)))||(!chatId&&((tab==='contacts'&&(roster||people))||(tab==='moments'&&moments)||(tab==='settings'&&profile)))||(window.MushuiDesktop&&(people||roster))))render();

  if(!modal&&typeof refreshDesktopSidebar==='function')refreshDesktopSidebar();updateUnreadDots(state);updateAccountConnectionNotice();

 }catch{}finally{crossPollBusy=false;if(crossPollAgain){crossPollAgain=false;void refreshCrossDevice();}}

}

function updateAccountConnectionNotice(){

 const root=document.querySelector('.conversation,.page');if(!root)return;let notice=root.querySelector(':scope > .account-connection-notice');

 const error=state?.accountSync?.error,connected=humanData().connected;

 if(!connected||!error){notice?.remove();return;}

 if(!notice){notice=document.createElement('button');notice.className='account-connection-notice';notice.dataset.action='accountSync';root.querySelector('.top')?.after(notice);}

 const message='跨裝置同步未完成：'+error+' · 點此檢查';if(notice.textContent!==message)notice.textContent=message;

}

const accountNoticeRender=render;render=function(){accountNoticeRender();updateAccountConnectionNotice();};

window.addEventListener('mushui-account-updated',()=>void refreshCrossDevice());

setInterval(()=>{if(state&&humanData().connected)void refreshCrossDevice();},window.IOSHost?4000:3000);

// Keep polling while the desktop window is hidden in the tray. The notification
// bridge intentionally emits native notifications only while document.hidden;
// stopping the poll here made that path impossible to reach.
setInterval(()=>{if(!window.DesktopDetached&&state&&humanData().connected&&(!document.hidden||window.MushuiDesktop))WebEngine.humanSync().then(()=>refreshCrossDevice()).catch(()=>{});},window.IOSHost?4000:2500);

const syncHumanAfterResume=()=>{if(!window.DesktopDetached&&state&&humanData().connected)WebEngine.humanSync().then(()=>refreshCrossDevice()).catch(()=>{});};

document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncHumanAfterResume();});

window.addEventListener('pageshow',syncHumanAfterResume);



if(window.MushuiAIOnly){

 const allowed=new Set(['login','register','logout','configure','profile','deleteAccount','sync','background']);const human=WebEngine.human;WebEngine.human=d=>{if(!allowed.has(d.action))return Promise.reject(Error('純 AI 版不提供真人功能'));return human(d);};

 contactMode='ai';humanModeButtons=()=>'';const contacts=contactsView;contactsView=function(){contactMode='ai';return contacts();};

 const data=humanData;humanData=function(){const h=data(),official=(h.friends||[]).filter(p=>p.official),messages=(h.messages||[]).filter(m=>m.official||m.sender==='official-mushui'||m.recipient==='official-mushui');return {...h,friends:official,requests:[],messages,relationshipRequests:[]};};

 const accountUI=actions.humanAccount;actions.humanAccount=()=>{accountUI();const p=document.querySelector('.sheet .help');if(p)p.textContent='此帳號僅供 AI 資料跨裝置同步使用，不提供真人好友、訊息與通話。伺服器、ID 與密碼須與另一台一致。';document.querySelectorAll('[data-action=humanBackground],[data-action=notifications]').forEach(x=>x.remove());};

 const settings=settingsView;settingsView=function(){return settings().replaceAll('人類帳號與好友伺服器','AI 同步帳號').replaceAll('人類帳號與伺服器','AI 同步帳號');};

 const poll=pollCalls;pollCalls=async()=>{};

}



if(window.AndroidHost){const account=actions.humanAccount;actions.humanAccount=()=>{account();const server=document.querySelector('#humanServer');if(server?.value.startsWith('https://mushui.local'))server.value='';};}



if(window.IOSHost){const account=actions.humanAccount;actions.humanAccount=()=>{account();const input=document.querySelector('#humanServer');if(input?.value.startsWith('http://127.0.0.1:'))input.value='';};}

