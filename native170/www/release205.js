'use strict';

function relationshipCard(m){const r=m.relationshipInvite;if(!r)return '';const human=isHumanChat(),me={...person('me'),name:humanData().me?.name||state.settings.nickname||'我',avatar:humanData().me?.avatar||state.settings.avatar},sender=human?(m.sender===humanData().me.id?me:humanFriend(m.sender)):person(m.author),recipient=human?(m.recipient===humanData().me.id?me:humanFriend(m.recipient)):me,label=relationTypes[r.type]?.label==='自訂'?r.label:relationTypes[r.type]?.label||r.label||'關係',mine=human&&m.sender===humanData().me.id;return `<section class="relationship-request-card"><div class="relationship-portraits">${avatar(sender,'large')}<svg viewBox="0 0 120 56" aria-hidden="true"><path d="M60 28C38 -10 3 0 5 28S42 65 60 28S115 -10 115 28S78 65 60 28" fill="none" stroke="currentColor" stroke-width="4"/></svg>${avatar(recipient,'large')}</div><b>${esc(sender.name)}請求與${mine?esc(recipient.name):'您'}綁定${esc(label)}關係</b><p>${esc(r.note||'接受後，這段關係才會生效。')}</p><small>紀念日：${esc(r.anniversary||'尚未設定')}</small>${r.status==='pending'?(mine?'<p class="help">等待對方回覆</p>':`<div class="sheet-actions">${human?`<button class="pill primary" data-relationship-response="accept" data-peer="${esc(m.sender)}">接受</button><button class="pill" data-relationship-response="decline" data-peer="${esc(m.sender)}">婉拒</button>`:`<button class="pill primary" data-acceptrelation="${esc(m.id)}">接受</button><button class="pill" data-declinerelation="${esc(m.id)}">婉拒</button>`}</div>`):`<p class="help">${r.status==='accepted'?'已接受關係邀請':r.status==='declined'?'已婉拒':'關係已解除'}</p>`}</section>`;}

relationInviteHtml=relationshipCard;

const release205Render=render;render=function(){release205Render();if(isHumanChat())for(const row of document.querySelectorAll('.message[data-message-id]')){const m=messageById(row.dataset.messageId),bubble=row.querySelector('.bubble');if(m?.relationshipInvite&&bubble&&!bubble.querySelector('.relationship-request-card'))bubble.insertAdjacentHTML('beforeend',relationshipCard(m));}if(window.MizukiStaffEdition&&state?.human?.connected)refreshVerifiedStaffRole();};

document.addEventListener('click',e=>{const b=e.target.closest('[data-relationship-response]');if(!b)return;b.disabled=true;humanCall({action:'relation',verb:b.dataset.relationshipResponse,id:b.dataset.peer}).then(()=>{render();toast('關係邀請已更新');}).catch(err=>{b.disabled=false;toast(err.message);});});

let staffRoleOwner='',staffRoleBusy=false;

async function refreshVerifiedStaffRole(){const owner=humanData().serverUrl+'|'+humanData().me.id;if(staffRoleBusy||staffRoleOwner===owner)return;staffRoleBusy=true;try{const r=await WebEngine.humanRequest('/v1/support');window.MizukiVerifiedStaff=r.staff===true;staffRoleOwner=owner;render();}catch{window.MizukiVerifiedStaff=false;}finally{staffRoleBusy=false;}}

if(window.MizukiStaffEdition){const profileBeforeRole=profilePage;profilePage=function(){return profileBeforeRole().replace('<span class="wx-coin-balance">∞</span>',`<span class="wx-coin-balance">${window.MizukiVerifiedStaff?'∞':'待驗證'}</span>`);};}

const release205Style=document.createElement('style');release205Style.textContent=`.relationship-request-card{padding:18px;border:1px solid var(--line);border-radius:20px;background:var(--soft);min-width:210px;max-width:100%;text-align:center}.relationship-portraits{display:flex;align-items:center;justify-content:center;margin:4px 0 18px;gap:0}.relationship-portraits .avatar{width:56px;height:56px;flex:none}.relationship-portraits svg{width:80px;height:46px;color:#df879d;flex:none}.relationship-request-card b{display:block;line-height:1.6}.relationship-request-card p{font-size:13px;line-height:1.6}.relationship-request-card small{color:var(--muted)}.relationship-request-card .sheet-actions{display:flex;justify-content:center;gap:12px;margin-top:16px}.permission-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}`;document.head.append(release205Style);



// Staff edition is locked until both login and server-side role verification succeed.

const staffGateBaseRender=render;

render=function(){

 if(!window.MizukiStaffEdition){staffGateBaseRender();return;}

 const h=state?.human,owner=h?.serverUrl+'|'+h?.me?.id;

 if(!h?.connected){window.MizukiVerifiedStaff=false;staffRoleOwner='';staffGateBaseRender();document.title='水沐';document.querySelectorAll('.login-gate .eyebrow').forEach(el=>el.textContent='水沐');return;}

 if(staffRoleOwner!==owner||!window.MizukiVerifiedStaff){

  document.title='水沐';$('#app').innerHTML=`<main class="login-gate"><div class="login-gate-card"><h1>水沐</h1><p>${staffRoleOwner===owner?'此帳號未獲授權使用官方客服版':'正在驗證官方客服身分…'}</p><div class="sheet-actions"><button class="pill" data-action="retryStaffVerification">重新驗證</button><button class="pill" data-action="humanLogout">登出</button></div></div></main>`;

  if(staffRoleOwner!==owner)refreshVerifiedStaffRole();return;

 }

 staffGateBaseRender();document.title='水沐';

};

actions.retryStaffVerification=()=>{staffRoleOwner='';window.MizukiVerifiedStaff=false;render();};

