'use strict';
function chatPinned(id){return id.startsWith('human:')?!!humanData().pins?.[id.slice(6)]:!!state.chats.find(c=>c.id===id)?.pinned;}
const chatsBeforeRevision=chatsView;
chatsView=function(){
 const h=humanData(),q=search.trim().toLowerCase();if(!state.chats.length&&!h.friends.length)return chatsBeforeRevision();
 const rows=[...state.chats.map(c=>({id:c.id,name:title(c),face:chatAvatar(c),last:c.messages.at(-1),kind:'AI',pinned:!!c.pinned})),...h.friends.map(p=>({id:'human:'+p.id,name:p.name,face:avatar(p),last:h.messages.filter(m=>m.sender===p.id||m.recipient===p.id).at(-1),kind:'人類',pinned:!!h.pins?.[p.id]}))].filter(r=>!q||r.name.toLowerCase().includes(q)||r.id.includes(q)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.last?.time||0)-(a.last?.time||0));
 return header('聊天','讓重要的人，留在上面。',btn('newChat','plus','建立新聊天或群組'))+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋聊天" aria-label="搜尋聊天"></div><div class="content">${rows.map(r=>`<div class="chat-entry ${r.pinned?'pinned-chat':''}"><button class="chat-row" ${r.id.startsWith('human:')?'data-humanchat="'+esc(r.id.slice(6))+'"':'data-chat="'+esc(r.id)+'"'}><span class="chat-face" data-unread-chat="${esc(r.id)}">${r.face}</span><div class="chat-info"><h3><span>${esc(r.name)} <small>${r.kind}</small></span><time class="time">${r.last?ago(r.last.time):''}</time></h3><p>${esc(r.last?.audio?'［語音］':r.last?.text||'開始聊天')}</p></div></button><button class="chat-pin ${r.pinned?'selected':''}" data-pinchat="${esc(r.id)}" aria-label="${r.pinned?'取消置頂':'置頂'} ${esc(r.name)}">${r.pinned?'取消置頂':'置頂'}</button></div>`).join('')||'<p class="help">沒有符合的聊天。</p>'}</div>`;
};
const humanRowBeforeRevision=humanRow;
humanRow=function(p){return `<div class="contact-entry">${humanRowBeforeRevision(p)}<button class="contact-delete" data-removefriend="${esc(p.id)}" aria-label="刪除好友 ${esc(p.name)}">${icon('trash')}</button></div>`;};
const accountBeforeRevision=actions.humanAccount;
actions.humanAccount=()=>{accountBeforeRevision();if(humanData().connected)document.querySelector('#modalError').insertAdjacentHTML('beforebegin',`<div class="card"><h3>我的好友頭像</h3>${avatar(humanData().me,'large')}<button class="pill" data-action="humanAvatar">選擇並同步頭像</button><p class="help">此頭像會同步給人類好友；AI 的頭像可在角色資料編輯。</p></div>`);};
actions.humanAvatar=async()=>{const image=await pickImage();if(!image)return;await humanCall({action:'profile',name:humanData().me.name,avatar:image});actions.humanAccount();render();};
actions.manualRefresh=async()=>{if(busy||humanSyncing)return;try{if(humanData().connected)await humanCall({action:'sync'});state=await call('load');render();toast('已刷新',1000);}catch(e){toast(e.message);}};
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
 if(b.dataset.pinchat){const id=b.dataset.pinchat;if(id.startsWith('human:'))await humanCall({action:'pin',id:id.slice(6)});else await mutate('pinChat',{id});render();}
 if(b.dataset.removefriend){const id=b.dataset.removefriend;confirmModal('刪除好友','將解除雙方好友關係，停止新的訊息與通話。既有訊息仍保留在各自本機與伺服器，重新加入需再次接受申請。',async()=>{await humanCall({action:'remove',id});if(chatId==='human:'+id)chatId='';closeModal();render();});}
 }catch(error){toast(error.message);}});
let revealedChatId='',revealedTextKeys=new Set();
const renderBeforeRevision=render;
render=function(){if(revealedChatId!==chatId){revealedPhotos.clear();revealedTextKeys.clear();revealedChatId=chatId;}renderBeforeRevision();if(!state)return;document.querySelectorAll('.message[data-message-id]').forEach(m=>m.querySelectorAll('[data-revealspoiler]').forEach((b,i)=>{const key=chatId+':'+m.dataset.messageId+':'+i;b.dataset.spoilerkey=key;if(revealedTextKeys.has(key)){b.classList.add('revealed');b.setAttribute('aria-expanded','true');b.setAttribute('aria-label','已揭開文字，點一下隱藏');b.querySelector('span')?.setAttribute('aria-hidden','false');}}));if(chatId){const top=document.querySelector('.conversation .top');top?.insertAdjacentHTML('beforeend',`<button class="chat-pin ${chatPinned(chatId)?'selected':''}" data-pinchat="${esc(chatId)}" aria-label="${chatPinned(chatId)?'取消置頂聊天室':'置頂聊天室'}">${chatPinned(chatId)?'已置頂':'置頂'}</button>`);}};
function fitViewport(){const v=window.visualViewport;document.documentElement.style.setProperty('--app-height',(v?.height||window.innerHeight)+'px');}
window.visualViewport?.addEventListener('resize',fitViewport);window.addEventListener('resize',fitViewport);fitViewport();
if(state)render();

document.addEventListener('click',e=>{const b=e.target.closest('[data-revealspoiler][data-spoilerkey]');if(!b)return;if(b.getAttribute('aria-expanded')==='true')revealedTextKeys.add(b.dataset.spoilerkey);else revealedTextKeys.delete(b.dataset.spoilerkey);});

let unreadSnapshot=null,unreadChecking=false;
function unreadFor(id,s=unreadSnapshot||state){if(!s)return false;if(!id.startsWith('human:'))return !!s.chats.find(c=>c.id===id)?.unread;const peer=id.slice(6),h=s.human||{},through=h.reads?.[peer]||0;return (h.messages||[]).some(m=>m.sender===peer&&Number(m.id)>through);}
function updateUnreadDots(s=unreadSnapshot||state){let any=false;document.querySelectorAll('[data-unread-chat]').forEach(el=>{const unread=unreadFor(el.dataset.unreadChat,s);el.querySelector('.chat-unread-dot')?.remove();if(unread){el.insertAdjacentHTML('beforeend','<i class="chat-unread-dot" role="status" aria-label="未讀訊息"></i>');any=true;}});const nav=document.querySelector('[data-tab="chats"]');if(nav){nav.querySelector('.dot')?.remove();const exists=any||(s?.chats||[]).some(c=>c.unread)||(s?.human?.friends||[]).some(p=>unreadFor('human:'+p.id,s));if(exists)nav.insertAdjacentHTML('beforeend','<i class="dot"></i>');}}
const renderBeforeUnread=render;render=function(){renderBeforeUnread();unreadSnapshot=state;updateUnreadDots(state);if(chatId.startsWith('human:')){const peer=chatId.slice(6),h=humanData(),through=Math.max(0,...h.messages.filter(m=>m.sender===peer).map(m=>Number(m.id)||0));if(through>(h.reads?.[peer]||0)){h.reads||={};h.reads[peer]=through;call('human',{action:'read',id:peer,through}).catch(()=>{});}}};
setInterval(async()=>{if(!state||document.hidden||unreadChecking)return;unreadChecking=true;try{if(humanData().connected)await call('human',{action:'sync'});unreadSnapshot=await call('load');updateUnreadDots(unreadSnapshot);}catch{}finally{unreadChecking=false;}},5000);

const optionsBeforeManualChat=chatOptions;chatOptions=function(){optionsBeforeManualChat();};actions.chatOptions=chatOptions;actions.refreshChat=async()=>{closeModal();await actions.manualRefresh();};

function noticeSignature(section,s){if(!s)return '';let data=[];
 if(section==='contacts')data=[...(s.human?.requests||[]).map(r=>r.id),...(s.human?.relationshipRequests||[]).map(r=>[r.sender,r.data?.label])];
 if(section==='moments')data=(s.moments||[]).flatMap(p=>{const other=p.author!=='me'?[p.id,p.author,p.time]:[],comments=(p.comments||[]).filter(c=>c.author!=='me').map(c=>[p.id,c.author,c.time,c.text]),likes=(p.likes||[]).filter(id=>id!=='me').map(id=>[p.id,'like',id]);return [...(other.length?[other]:[]),...comments,...likes];});
 if(section==='settings')data=[s.activity?.lastError,s.human?.lastError,...(s.chats||[]).map(c=>c.memoryError)].filter(Boolean);
 if(!data.length)return '';const text=JSON.stringify(data);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return String(hash>>>0);
}
const dotsBeforeSections=updateUnreadDots;updateUnreadDots=function(s=unreadSnapshot||state){dotsBeforeSections(s);for(const section of ['contacts','moments','settings']){const signature=noticeSignature(section,s),unread=signature&&signature!==s?.noticeReads?.[section],button=document.querySelector('[data-tab="'+section+'"]');button?.querySelector('.dot')?.remove();if(unread)button?.insertAdjacentHTML('beforeend','<i class="dot" role="status" aria-label="新通知"></i>');}};
const renderBeforeSectionReads=render;render=function(){renderBeforeSectionReads();if(!state||chatId||!['contacts','moments','settings'].includes(tab))return;const signature=noticeSignature(tab,state);state.noticeReads||={};if(state.noticeReads[tab]!==signature){state.noticeReads[tab]=signature;call('mutate',{action:'noticeRead',section:tab,signature}).catch(()=>{});}updateUnreadDots(state);};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!unreadSnapshot||dirty)return;if(b.dataset.tab||b.dataset.humanchat)state=unreadSnapshot;},{capture:true});

const renderBeforeStartupCache=render;render=function(){if(state)window.cacheStartupFont?.(state.settings);renderBeforeStartupCache();};

const humanAccountBeforeDeletion=actions.humanAccount;actions.humanAccount=()=>{humanAccountBeforeDeletion();if(humanData().connected)document.querySelector('#modalError')?.insertAdjacentHTML('beforebegin','<button class="link-button danger" data-action="deleteHumanAccount">刪除伺服器帳號</button>');};
actions.deleteHumanAccount=()=>showModal('永久刪除好友帳號','<p class="help">將刪除伺服器上的帳號、好友關係、申請、傳送與接收的訊息及推播訂閱，也會清除此裝置的人類帳號快取。無法復原；AI 角色與本機 AI 聊天保留。其他裝置已下載的快取與你匯出的備份不會自動刪除。請輸入密碼確認。</p><input id="deleteAccountPassword" type="password" autocomplete="current-password"><button class="pill danger" data-action="confirmDeleteAccount">永久刪除帳號</button>');
actions.confirmDeleteAccount=async()=>{await humanCall({action:'deleteAccount',password:document.querySelector('#deleteAccountPassword').value});closeModal();chatId='';render();toast('好友帳號已刪除');};

const dotsBeforeChatOrder=updateUnreadDots;updateUnreadDots=function(s=unreadSnapshot||state){dotsBeforeChatOrder(s);const entries=[...document.querySelectorAll('.chat-entry')];if(entries.length<2)return;const meta=id=>{if(id.startsWith('human:')){const peer=id.slice(6);return {pin:!!s.human?.pins?.[peer],time:(s.human?.messages||[]).filter(m=>m.sender===peer||m.recipient===peer).at(-1)?.time||0};}const c=s.chats.find(c=>c.id===id);return {pin:!!c?.pinned,time:c?.messages.at(-1)?.time||0};};const sorted=entries.slice().sort((a,b)=>{const x=meta(a.querySelector('[data-pinchat]').dataset.pinchat),y=meta(b.querySelector('[data-pinchat]').dataset.pinchat);return Number(y.pin)-Number(x.pin)||y.time-x.time;});if(sorted.some((el,i)=>el!==entries[i])){const parent=entries[0].parentElement;for(const el of sorted)parent.append(el);}};
