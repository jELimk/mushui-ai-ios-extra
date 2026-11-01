/* 2.0.5 incremental UX and account fixes. */

'use strict';

const release204OriginalPerson=person;

person=function(id){if(id==='official-mushui')return{id,name:state.settings.language==='en'?'Mizuki':'沐水',avatar:'official-avatar.png',cover:'official-cover.png',bio:officialBio(),official:true};return release204OriginalPerson(id);};

const release204Avatar=avatar;

avatar=function(p,extra=''){const src=String(p?.avatar||'');if(src==='official-avatar.png')return `<span class="avatar ${extra}"><img src="official-avatar.png" alt="${esc(p.name||'沐水')}"></span>`;return release204Avatar(p,extra);};

const release204HumanData=humanData;

humanData=function(){const h=release204HumanData();return {...h,friends:h.friends.map(p=>p.id==='official-mushui'?{...p,...person('official-mushui')}:p)};};

const release204Header=header;

header=function(name,sub='',right=''){return release204Header(name,sub,right).replace('MUSHUI · 沐水','沐水 · Mizuki');};

function release204Device(){return typeof deviceLabel==='function'?deviceLabel():'裝置';}

function release204Prefs(){try{return JSON.parse(localStorage.getItem('mushui-chat-prefs')||'{}')}catch{return {};}}

const release204BaseChats=chatsView;

chatsView=function(){

 const q=search.trim().toLocaleLowerCase();if(!q)return release204BaseChats();

 const prefs=release204Prefs(),hidden=new Set(prefs.hidden||[]),deleted=new Set(prefs.deleted||[]),matches=[];

 const aiRows=state.chats.filter(c=>!hidden.has(c.id)&&!deleted.has(c.id)).map(c=>{const msgs=c.messages||[],found=msgs.filter(m=>String(m.text||'').toLocaleLowerCase().includes(q));return{id:c.id,name:title(c),face:chatAvatar(c),kind:c.members.length>1?'group':'AI',count:found.length,last:msgs.at(-1),snippets:found.slice(-3)};});

 const h=humanData(),people=h.friends.filter(p=>!hidden.has('human:'+p.id)&&!deleted.has('human:'+p.id)).map(p=>{const msgs=h.messages.filter(m=>m.sender===p.id||m.recipient===p.id),found=msgs.filter(m=>String(m.text||'').toLocaleLowerCase().includes(q));return{id:'human:'+p.id,name:p.name,face:avatar(p),kind:p.official?'官方':'人類',count:found.length,last:msgs.at(-1),snippets:found.slice(-3)};});

 const contact=[...people,...aiRows].filter(r=>r.name.toLocaleLowerCase().includes(q)||r.id.toLocaleLowerCase().includes(q));

 const groups=aiRows.filter(r=>r.kind==='group'&&(r.name.toLocaleLowerCase().includes(q)||r.count));

 const msgs=[...people,...aiRows].filter(r=>r.count).sort((a,b)=>b.count-a.count).map(r=>({...r,kind:'訊息'}));

 const row=r=>`<button class="chat-search-result" ${r.id.startsWith('human:')?'data-humanchat':'data-chat'}="${esc(r.id.startsWith('human:')?r.id.slice(6):r.id)}">${r.face}<span class="chat-search-copy"><b>${esc(r.name)} <small>${r.kind}</small></b>${r.snippets?.length?r.snippets.slice(-1).map(m=>`<small>${esc(String(m.text||'').slice(0,110))}</small>`).join(''):''}${r.count?`<small>${r.count} 條相關記錄</small>`:''}</span><span class="chevron">›</span></button>`;

 return header('聊天','讓重要的人，留在上面。',btn('newChat','plus','建立新聊天或群組'))+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋聊天記錄" aria-label="搜尋聊天記錄"></div><div class="content"><h3 class="search-section-title">聯絡人</h3>${contact.length?contact.map(row).join(''):'<p class="help">沒有符合的聯絡人。</p>'}<h3 class="search-section-title">群組</h3>${groups.length?groups.map(row).join(''):'<p class="help">沒有符合的群組。</p>'}<h3 class="search-section-title">相關訊息</h3>${msgs.length?msgs.map(row).join(''):'<p class="help">沒有找到相關訊息。</p>'}</div>`;

};

const release204Options=actions.chatOptions;

actions.chatOptions=function(){

 const id=chatId, human=id.startsWith('human:'), peer=human?id.slice(6):'', p=human?humanFriend(peer):null, ch=human?null:state.chats.find(c=>c.id===id);if(!p&&!ch)return;

 const vis={...(state.settings.personVisibility||{})},target=human?peer:(ch.members[0]||''),enabled=!!(vis[target]?.moments!==false);

 showModal('聊天設定',`<h3>${esc(human?p.name:title(ch))}</h3><p class="help">${human?(p.official?'沐水官方帳號':'人類好友 · ID '+esc(peer)):ch.members.map(x=>esc(ai(x).name)).join('、')}</p>${human&&!p.official?`<button class="setting-choice full" data-action="humanSync">同步好友訊息　›</button>`:''}<div class="privacy-toggle-row"><span><b>查看對方朋友圈</b><small>關閉後，此聊天中不顯示對方的朋友圈入口。</small></span><button class="switch ${enabled?'on':''}" role="switch" aria-checked="${enabled}" data-toggle-moments="${esc(target)}"><i></i></button></div>${!human?`<div class="card"><h3>這段對話的背景</h3><p class="small">單獨設定的背景優先於全域聊天背景。</p><button class="pill" data-action="oneChatBg">選擇圖片</button><button class="link-button" data-action="resetChatBg">使用全域背景</button></div>`:''}<button class="setting-choice full" data-action="searchThisChat">搜尋聊天記錄　›</button><button class="link-button danger" data-action="deleteChat">刪除此聊天紀錄</button>`);

};

actions.searchThisChat=()=>{closeModal();showModal('搜尋聊天記錄',`<input id="chatSearchQuery" placeholder="輸入文字" value="${esc(window.chatSearchQuery||'')}"><div class="chat-search-filters"><label>類型<select id="chatSearchType"><option value="all">全部</option><option value="image">圖片</option><option value="video">影片</option><option value="link">連結</option><option value="pinned">置頂</option><option value="mention">提及</option></select></label><label>來自<select id="chatSearchAuthor"><option value="">所有人</option>${(isHumanChat()?[humanData().me,...(humanData().friends||[])]:[...state.chats.find(c=>c.id===chatId).members.map(person),person('me')]).map(p=>`<option value="${esc(p?.id||'me')}">${esc(p?.name||'我')}</option>`).join('')}</select></label><label>日期<select id="chatSearchDateMode"><option value="any">任何日期</option><option value="before">早於</option><option value="after">晚於</option><option value="exact">指定日期</option></select></label><input id="chatSearchDate" type="date"><button class="pill primary" data-action="runChatSearch">搜尋</button></div><div id="chatSearchResults"></div>`);};

actions.runChatSearch=()=>{const q=document.querySelector('#chatSearchQuery')?.value.trim().toLowerCase()||'',id=chatId,type=document.querySelector('#chatSearchType')?.value||'all',author=document.querySelector('#chatSearchAuthor')?.value||'',mode=document.querySelector('#chatSearchDateMode')?.value||'any',dateValue=document.querySelector('#chatSearchDate')?.value||'';window.chatSearchQuery=q;let list=[];if(id.startsWith('human:'))list=humanData().messages.filter(m=>m.sender===id.slice(6)||m.recipient===id.slice(6));else list=state.chats.find(c=>c.id===id)?.messages||[];const found=list.filter(m=>{if(q&&!String(m.text||'').toLowerCase().includes(q))return false;if(author&&String(m.sender||m.author||'')!==author)return false;if(type==='image'&&!(m.images?.length||m.image))return false;if(type==='video'&&!m.files?.some(f=>String(f.type||'').startsWith('video/')))return false;if(type==='link'&&!/https?:\/\//i.test(m.text||''))return false;if(type==='mention'&&!/@[\w\u3400-\u9fff-]+/u.test(m.text||''))return false;if(type==='pinned'&&!((state.chats.find(c=>c.id===id)?.pinnedMessages||[]).includes(m.id)||(state.human?.messagePins||[]).some(p=>String(p.id)===String(m.id))))return false;if(dateValue){const target=new Date(dateValue+'T00:00:00').getTime(),day=new Date(m.time);day.setHours(0,0,0,0);const stamp=day.getTime();if(mode==='before'&&stamp>=target)return false;if(mode==='after'&&stamp<=target)return false;if(mode==='exact'&&stamp!==target)return false;}return true;});const el=document.querySelector('#chatSearchResults');if(el)el.innerHTML=found.length?found.slice(-100).reverse().map(m=>`<button class="setting-choice full chat-search-hit" data-search-message="${esc(m.id)}">${esc(String(m.text||'［附件］').slice(0,160))}<small>${new Date(m.time).toLocaleString()}</small></button>`).join(''):'<p class="help">沒有符合的訊息。</p>';};

const release204BaseChatView=chatView;

chatView=function(){let html=release204BaseChatView();if(!html)return html;html=html.replace('MUSHUI · 沐水','沐水 · Mizuki').replace('對方正在輸入中…','對方正在輸入中...').replace(/<button[^>]*data-action="humanSync"[^>]*>[\s\S]*?<\/button>/,'').replace(/<button class="link-button" data-action="configurePoke">拍一拍<\/button>/,'');if(isHumanChat()&&chatId==='human:official-mushui'){html=html.replace('<button class="pill" data-action="openOfficialMoments">朋友圈</button>','').replace(/<div class="official-quick-actions">[\s\S]*?<\/div>/,'');html=html.replace('</form></main>',`</form><div class="official-quick-actions official-quick-actions-top"><button class="pill" data-action="officialAccount">帳號</button><button class="pill" data-action="officialHelp">幫助</button></div></main>`);}return html;};

const release204MomentsView=momentsView;

momentsView=function(){const blocked=new Set(state.settings.blockedPeople||[]),orig=state.moments;state.moments=orig.filter(p=>!blocked.has(p.author)&&(!p.author?.startsWith('human:')||!blocked.has(p.author.slice(6)))&&!(p.author!=='me'&&p.author!=='official-mushui'&&!state.ais.some(a=>a.id===p.author)));try{return release204MomentsView().replaceAll('MUSHUI · 沐水','Mizuki · 沐水');}finally{state.moments=orig;}};

// Preserve short-lived drafts locally and offer recovery on the next compose.

const release204Compose=actions.compose;let release204PostActive=false;

actions.compose=()=>{try{const d=JSON.parse(localStorage.getItem('mushui-moment-draft')||'null');if(d&&Date.now()-d.time<3*86400000){posting.text=d.text||'';posting.images=d.images||[];}}catch{}release204PostActive=true;release204Compose();};

const release204Publish=actions.publish;

actions.publish=async()=>{await release204Publish();release204PostActive=false;localStorage.removeItem('mushui-moment-draft');};

const release204Back=window.goBack;window.goBack=function(){if(release204PostActive&&document.querySelector('#postText')){confirmModal('保留這則草稿？','保留草稿可在 3 天內繼續編輯。',()=>{localStorage.setItem('mushui-moment-draft',JSON.stringify({text:posting.text,images:posting.images,time:Date.now()}));release204PostActive=false;closeModal();toast('草稿已儲存');},()=>{posting={text:'',images:[]};localStorage.removeItem('mushui-moment-draft');release204PostActive=false;closeModal();});return true;}return release204Back();};

window.addEventListener('beforeunload',()=>{if(posting.text||posting.images?.length)localStorage.setItem('mushui-moment-draft',JSON.stringify({text:posting.text,images:posting.images,time:Date.now()}));});



// Calls are recorded only when connected and when ended; include elapsed call time.

const callStartedAt=new Map(),release204CallStatus=humanCallStatus;

humanCallStatus=async function(peer,status,callId,phase='ended'){

 if(phase==='ringing')return;

 if(phase==='active')callStartedAt.set(callId,Date.now());

 if(phase==='ended'){const started=callStartedAt.get(callId),seconds=started?Math.max(1,Math.round((Date.now()-started)/1000)):0;status=`已結束${humanFriend(peer).name}的${seconds?Math.floor(seconds/60)+' 分 '+seconds%60+' 秒':''}通話`;callStartedAt.delete(callId);}

 return release204CallStatus(peer,status,callId,phase);

};

// Contact star/favorite sections and user notes are readable and searchable.

const release204HumanRow=humanRow;

humanRow=function(p){let note=String(p.note||p.remark||'').trim();try{note=note||JSON.parse(localStorage.getItem('mushui-contact-notes')||'{}')[p.id]||'';}catch{}const official=p.official||p.id==='official-mushui';let html=release204HumanRow({...p,name:official?'Mizuki':p.name});if(!official)html=html.replace(`<small class="small" style="display:block">ID：${esc(p.id)}</small>`,note?`<small class="small" style="display:block">${esc(note)}</small>`:'');return html;};

const release204Contacts=contactsView;

contactsView=function(){

 const q=search.trim().toLowerCase(),human=contactMode==='human';

 if(!human){const items=state.ais.filter(a=>!q||a.name.toLowerCase().includes(q)||String(a.remark||a.note||'').toLowerCase().includes(q)||contactSort(a.name).key.includes(q));const favorites=items.filter(a=>a.favorite),stars=items.filter(a=>!a.favorite&&a.specialStar),others=items.filter(a=>!a.favorite&&!a.specialStar);return header('聯絡人','按拼音 A–Z 排列',btn('import','plus','匯入 AI 角色'))+humanModeButtons()+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋名字、備註或拼音"></div><div class="content">${favorites.length?`<section class="contact-favorites"><div class="favorites-title">${icon('heart')} 最愛</div>${contactSection(favorites,false)}</section>`:''}${stars.length?`<section class="contact-favorites"><div class="favorites-title">${icon('star')} 星星</div>${contactSection(stars,false)}</section>`:''}${contactSection(others)}</div>`;}

 const h=humanData(),list=h.friends.filter(p=>!q||p.id.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||String(p.note||p.remark||'').toLowerCase().includes(q)||contactSort(p.name).key.includes(q));const fav=list.filter(x=>x.favorite),star=list.filter(x=>!x.favorite&&x.specialStar),official=list.filter(x=>x.official),rest=list.filter(x=>!x.favorite&&!x.specialStar&&!x.official);

 const rows=(xs)=>xs.map(p=>humanRow(p)).join('');let last='';const grouped=rest.map(p=>{const letter=contactSort(p.name).letter,head=letter!==last?`<div class="letter">${letter}</div>`:'';last=letter;return head+humanRow(p)}).join('');

 return header('聯絡人','人類好友 · ID 與暱稱分開',btn('humanSearch','plus','搜尋 ID 加好友'))+humanModeButtons()+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋好友名字、ID 或拼音"></div><div class="content">${fav.length?`<section class="contact-favorites"><div class="favorites-title">${icon('heart')} 最愛</div>${rows(fav)}</section>`:''}${star.length?`<section class="contact-favorites"><div class="favorites-title">${icon('star')} 星星</div>${rows(star)}</section>`:''}${official.length?`<section class="contact-favorites"><div class="favorites-title">官方帳號</div>${rows(official)}</section>`:''}${grouped}</div>`;

};

// Remove the sync cloud control from the human chat header; sync continues on the existing timer/manual path.

const release204Styles=document.createElement('style');release204Styles.textContent=`.official-quick-actions-top{display:flex;justify-content:flex-start;gap:10px;padding:8px 14px;background:#fff9ffed}.contact-row{user-select:none;-webkit-user-select:none}.chat-search-result{display:flex;align-items:center;text-align:left;width:100%;gap:12px;padding:12px 8px;border-bottom:1px solid var(--line)}.chat-search-copy{display:grid;gap:4px;min-width:0;flex:1}.chat-search-copy small,.chat-search-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search-section-title{margin:20px 0 7px;color:var(--muted);font-size:calc(12px * var(--text-scale,1))}.privacy-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;margin:12px 0;border-radius:16px;background:var(--soft)}.privacy-toggle-row small{display:block;color:var(--muted);margin-top:4px}.switch{width:48px;height:28px;border-radius:20px;background:#cfc7d3;padding:3px;flex:none}.switch i{display:block;width:22px;height:22px;border-radius:50%;background:white;box-shadow:0 2px 5px #0002;transition:transform .2s}.switch.on{background:var(--accent)}.switch.on i{transform:translateX(20px)}.danger{color:#c35669!important}.moment .text.collapsed{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}.official-quick-actions{margin:8px 14px}.message .bubble,.message .author,.chat-row,.contact-row,.setting-row{-webkit-user-select:none;user-select:none}.message .bubble{user-select:text;-webkit-user-select:text}input,textarea,select,[contenteditable=true]{user-select:text;-webkit-user-select:text}`;document.head.append(release204Styles);

document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.toggleMoments){const all={...(state.settings.personVisibility||{})},person={...(all[b.dataset.toggleMoments]||{})};person.moments=person.moments===false;all[b.dataset.toggleMoments]=person;await mutate('settings',{settings:{...state.settings,personVisibility:all}});actions.chatOptions();return;}if(b.dataset.searchMessage){const id=b.dataset.searchMessage;closeModal();setTimeout(()=>document.querySelector(`[data-message-id="${CSS.escape(isHumanChat()?'human-':'')}${CSS.escape(id)}"]`)?.scrollIntoView({block:'center',behavior:'smooth'}),40);return;}}catch(error){modalError(error);}},true);



// Version-specific profile and utility wording.

const release204SettingsPage=settingsPage;

settingsPage=function(){let html=release204SettingsPage();return html.replace('2.0.2','2.0.5').replace('MUSHUI · 沐水','沐水 · Mizuki');};

const release204AccountPage=accountBaseSettingsPage;

const release204ProfilePage=profilePage;

profilePage=function(){return release204ProfilePage().replace('<b>支付與服務</b>','<b>沐水幣</b>').replace('沐水幣　','');};

const release204AccountPageRender=settingsPage;

settingsPage=function(){let html=release204AccountPageRender();if(page==='records')html=html.replace('<div class="wx-record-tabs"><span class="active">朋友圈</span><span>狀態</span></div>','<div class="wx-record-tabs"><button class="active" data-recordtab="moments">朋友圈</button><button data-recordtab="status">狀態</button></div>');if(page==='custom-stickers'){html=html.replace('不超過 10 MB。影片格式不支援。','不超過 25 MB。其他格式不支援。');html=html.replace(/<div><b>\$\{esc\(s.name\)\}<\\\/b><small>\$\{s.type===.image\/gif.\?.GIF.:.圖片.\}<\\\/small><\\\/div>/g,'');}return html;};

// Persist a human contact remark locally; it remains distinct from the unique account ID.

document.addEventListener('click',e=>{const row=e.target.closest('[data-humancontact]');if(!row||row.dataset.humancontact==='official-mushui')return;const id=row.dataset.humancontact;window.pendingContactNoteId=id;setTimeout(()=>{const card=document.querySelector('.sheet .human-profile');if(card&&!card.querySelector('[data-action="saveContactNote"]')){const notes=JSON.parse(localStorage.getItem('mushui-contact-notes')||'{}');card.insertAdjacentHTML('beforeend',`<label>備註</label><input id="contactNote" maxlength="30" value="${esc(notes[id]||'')}" placeholder="選填備註"><button class="pill" data-action="saveContactNote">儲存備註</button>`);}},0);},true);

document.addEventListener('click',e=>{const row=e.target.closest('[data-humancontact]');if(row&&row.dataset.humancontact!=='official-mushui')window.pendingContactNoteId=row.dataset.humancontact;},true);

actions.saveContactNote=async()=>{const id=window.pendingContactNoteId,note=document.querySelector('#contactNote')?.value.trim()||'';const notes=JSON.parse(localStorage.getItem('mushui-contact-notes')||'{}');if(note)notes[id]=note;else delete notes[id];localStorage.setItem('mushui-contact-notes',JSON.stringify(notes));closeModal();render();toast('備註已儲存');};

document.addEventListener('click',e=>{const b=e.target.closest('[data-recordtab]');if(!b)return;window.mizukiRecordTab=b.dataset.recordtab;render();},true);

const release204BirthdayModal=birthdayModal;

birthdayModal=function(id){const personData=id==='me'?{...state.settings,name:state.settings.nickname||'我'}:ai(id);if(personData.birthday){showModal(personData.name+'的生日','<p class="help">已設定生日，不可更改。</p><div class="card">'+esc(personData.birthday)+'</div>');return;}release204BirthdayModal(id);const sheet=document.querySelector('.sheet');if(sheet&&!sheet.querySelector('.birthday-surprise-note'))sheet.insertAdjacentHTML('beforeend','<p class="small birthday-surprise-note">設定生日的話，可以在生日當天收到來自 AI 的小驚喜哦。</p>');};

