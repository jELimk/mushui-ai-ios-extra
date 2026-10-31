'use strict';

const $=(s)=>document.querySelector(s), esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const paths={image:'M4 4h16v16H4z M7 15l3-3 2 2 2-3 3 5H7 M8 8h.01',mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',refresh:'M20 8a8 8 0 1 0 0 8 M20 3v5h-5',chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2v-6a8.5 8.5 0 1 1 19-4.5Z M7 10h.01 M12 10h.01 M17 10h.01',contacts:'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v8 M16 12h8',moments:'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9 M12 3v6l5-3 M21 12h-6l3 5 M12 21v-6l-5 3 M3 12h6L6 7',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',me:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21a8 8 0 0 1 16 0 M19 5h3 M20.5 3.5v3',plus:'M12 5v14 M5 12h14',search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',import:'M12 3v12 M7 10l5 5 5-5 M4 15v5h16v-5',back:'M15 5l-7 7 7 7',send:'m4 4 17 8-17 8 3-8-3-8 M7 12h14',camera:'M4 7h4l2-3h4l2 3h4v14H4Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8',heart:'M20.8 4.6c-2-2-5-1.6-6.8.2L12 7l-2-2.2C8 3 5 2.6 3.2 4.6c-2 2-1.8 5 .2 7l8.6 9 8.6-9c2-2 2.2-5 .2-7Z',more:'M5 12h.01 M12 12h.01 M19 12h.01',memory:'M9 3a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7 4 4 0 0 0 6 5V3 M15 3a4 4 0 0 1 4 4v1a4 4 0 0 1 2 7 4 4 0 0 1-6 5V3 M5 9h4 M15 14h4',cloud:'M7 18a5 5 0 0 1-1-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 1 11 M12 12v9 M8 17l4 4 4-4',palette:'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4c-1-1 1-2 3-2 5 0 4-12-6-12 M7 9h.01 M10 6h.01 M15 7h.01 M6 13h.01',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7h.01',check:'M5 12l4 4L20 5',close:'M6 6l12 12 M18 6 6 18',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',edit:'m16 3 5 5-13 13H3v-5Z M13 6l5 5',comment:'M21 11a9 9 0 0 1-9 9H5l-3 2v-8A9 9 0 1 1 21 11Z',trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7'};

const icon=(n)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.info}"/></svg>`;

const drop=()=>`<div class="droplet"><svg viewBox="0 0 120 145" aria-hidden="true"><defs><linearGradient id="d" x2=".9" y2="1"><stop stop-color="#dbc7e9"/><stop offset="1" stop-color="#b599c9"/></linearGradient></defs><path d="M60 5C52 25 20 58 20 85a40 40 0 0 0 80 0C100 58 68 25 60 5Z" fill="url(#d)"/><path d="M35 85q17 17 35 4t17 0q-3 27-27 28T35 85" fill="#fff" opacity=".65"/><ellipse cx="43" cy="64" rx="5" ry="8" fill="#fff" opacity=".6"/><circle cx="98" cy="29" r="4" fill="#e6c8da"/></svg></div>`;

const themes={lilac:{name:'芋泥紫',accent:'#a080ba',deep:'#76558f',soft:'#eee4f4',pink:'#edcddc',bg:'#f9f5fa',bubble:'#eadcf3',cover:'linear-gradient(135deg,#dccce9,#efd9e3 55%,#e8d9ca)'},rose:{name:'莓果奶',accent:'#c38fa4',deep:'#96647c',soft:'#f8e5ed',pink:'#e9cedc',bg:'#fff7f9',bubble:'#f4dce7',cover:'linear-gradient(130deg,#e8c6d6,#f3e0d5,#ead5ee)'},mint:{name:'薄荷糖',accent:'#82aca0',deep:'#507e71',soft:'#e0f1e9',pink:'#d7e5e8',bg:'#f3faf7',bubble:'#d9eee4',cover:'linear-gradient(135deg,#c5e3d7,#e2eee0,#eddfda)'},peach:{name:'蜜桃酪',accent:'#d2a089',deep:'#9a705c',soft:'#fae9de',pink:'#efd3d7',bg:'#fff9f4',bubble:'#f7e3d5',cover:'linear-gradient(135deg,#eed1c2,#f3dfd4,#e9dce8)'},blue:{name:'雲朵藍',accent:'#8da6c6',deep:'#5d789c',soft:'#e4edf8',pink:'#d9dcea',bg:'#f5f8fe',bubble:'#dfeafa',cover:'linear-gradient(135deg,#cbd9f0,#dbe5f2,#e9dcec)'},lemon:{name:'檸檬霜',accent:'#b6ac7c',deep:'#837b4f',soft:'#f4f0d9',pink:'#e9dfd4',bg:'#fdfbf3',bubble:'#f0ebcd',cover:'linear-gradient(135deg,#e3ddbb,#f0e6cc,#e1dfd8)'}};

const providers={Grok:{url:'https://api.x.ai/v1',models:['grok-4.7','grok-4.6','grok-4.5','grok-4-1-fast-non-reasoning']},ChatGPT:{url:'https://api.openai.com/v1',models:['gpt-4.1-mini','gpt-4.1','gpt-4.1-nano','gpt-4o','gpt-4o-mini','gpt-5','gpt-5-mini','gpt-5-nano','gpt-5.1','gpt-5.2','gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','o3','o4-mini']},Claude:{url:'https://api.anthropic.com/v1',models:['claude-sonnet-5-5','claude-opus-5-5','claude-haiku-5-5','claude-fable-5-1','claude-sonnet-5','claude-opus-5']},Gemini:{url:'https://generativelanguage.googleapis.com/v1beta/openai',models:['gemini-3.8-flash','gemini-3.6-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-lite','gemini-2.5-pro','gemini-2.5-flash']},DeepSeek:{url:'https://api.deepseek.com',models:['deepseek-flash','deepseek-v4-pro','deepseek-v4-flash']}};

const limits=[19,27,87,278];

let state=null,tab='chats',page='',chatId='',draft=null,dirty=false,apiKeyDraft=null,search='',filter='全部',modal=null,sending=new Set(),chatDrafts={},posting={text:'',images:[]},modelList=[],busy=false,toastTimer;

const pending=new Map();

function call(op,data={}){return new Promise((resolve,reject)=>{if(!window.Native){reject(new Error('請在 Android APK 中使用；此頁為介面預覽。'));return;}const id=crypto.randomUUID(); const timer=setTimeout(()=>{pending.delete(id);reject(new Error('操作逾時，請檢查網路後重試'));},900000);pending.set(id,{resolve,reject,timer});window.Native.request(id,op,JSON.stringify(data));});}

window.nativeResult=r=>{const p=pending.get(r.id);if(!p)return;clearTimeout(p.timer);pending.delete(r.id);r.ok?p.resolve(r.data):p.reject(new Error(r.error||'操作失敗'));};

function toast(text,duration=4000){const e=$('#toast');e.textContent=text;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),duration);}

function applyTheme(){const t=themes[(draft||state.settings).theme]||themes.lilac;for(const [k,v]of Object.entries(t))if(k!=='name')document.documentElement.style.setProperty('--'+(k==='deep'?'accent-deep':k),v);}

function deviceLabel(){const ua=navigator.userAgent||'',p=navigator.platform||'';if(/iPad/i.test(ua)||(p==='MacIntel'&&navigator.maxTouchPoints>1)||(/Android/i.test(ua)&&!/Mobile/i.test(ua)))return '平板';if(/iPhone|iPod|Mobile/i.test(ua)||window.AndroidHost||window.IOSHost)return '手機';if(window.MushuiDesktop)return '電腦';return '裝置';}

function ai(id){return state.ais.find(a=>a.id===id)||{id,name:'已移除的角色',avatar:''};}

// Official account bio, in the app language. The U+200E marks keep the kaomoji's Arabic letters
// (٩ and و) from being reordered by bidirectional text layout, which made it look misaligned.
function officialBio(){const choice=state?.settings?.uiLanguage||'system',en=choice==='en'||choice==='system'&&/^en(?:-|$)/i.test(navigator.language||''),face='٩‎(ˊᗜˋ*)‎و';return en?"Hanyo! I'm Mizuki! "+face:'泥嚎！我是沐水！'+face;}
function person(id){if(id==='official-mushui')return{id,name:window.MushuiLocale==='en'?'Mizuki':'沐水',avatar:'official-avatar.png',cover:'official-cover.png',bio:officialBio(),official:true};return id==='me'?{name:state.settings.nickname||'我',avatar:state.settings.avatar,birthday:state.settings.birthday}:ai(id);}

function avatar(p,extra=''){const image=p.avatar&&/^data:image\/(jpeg|png|webp);base64,/.test(p.avatar);return `<span class="avatar ${extra}">${image?`<img src="${esc(p.avatar)}" alt="${esc(p.name)}">`:esc((p.name||'沐').slice(0,1))}</span>`;}

function chatAvatar(ch,extra=''){if(ch.members.length<2)return avatar(ai(ch.members[0]),extra);if(ch.avatar)return avatar({name:title(ch),avatar:ch.avatar},extra);const ids=['me',...ch.members].slice(0,9),columns=ids.length<=4?2:3;return `<span class="avatar group-avatar ${extra}" role="img" aria-label="${esc(title(ch))}的成員頭像拼圖" style="--group-columns:${columns}">${ids.map(id=>`<span class="group-avatar-cell" data-group-member="${esc(id)}">${avatar(person(id))}</span>`).join('')}</span>`;}

function title(ch){return ch.title||ch.members.map(id=>ai(id).name).join('、');}

const time=(t)=>new Date(t).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});

const date=(t)=>new Date(t).toLocaleDateString('zh-TW',{month:'long',day:'numeric'});

function ago(t){const d=Date.now()-t;return d<60000?'剛剛':d<3600000?Math.floor(d/60000)+' 分鐘前':d<86400000?time(t):date(t);}

function header(name,sub='',right=''){return `<header class="top"><div class="eyebrow">Mizuki · 沐水</div><div class="between"><div><h1>${esc(name)}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div><div class="flex">${right}</div></div></header>`;}

function btn(action,ico,label,extra=''){return `<button class="icon-button ${extra}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ico)}</button>`;}

function saveButton(){return tab==='settings'&&['api','memory','individual','life','appearance','profile','images','notifications','chat'].includes(page)?`<button class="pill save" data-action="save">儲存</button>`:'';}

function nav(){const tabs=[['chats','chat','聊天'],['contacts','contacts','聯絡人'],['moments','moments','朋友圈'],['settings','me','我']];return `<nav class="nav" aria-label="主要導覽">${tabs.map(([id,ico,label])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-current="${tab===id?'page':'false'}"><span class="nav-icon">${icon(ico)}</span><span>${label}</span>${id==='chats'&&state.chats.some(c=>c.unread)?'<i class="dot"></i>':''}</button>`).join('')}</nav>`;}

function render(){if(!state)return;applyTheme();const focus=document.activeElement?.dataset.focus,sel=document.activeElement?.selectionStart;

if(chatId){updateConversationFrame(chatView());}

else{const bg=state.settings.appBg;$('#app').innerHTML=`<main class="page ${bg?'with-bg':''}">${page?settingsPage():tab==='chats'?chatsView():tab==='contacts'?contactsView():tab==='moments'?momentsView():settingsView()}</main>${nav()}`;if(bg)$('.page').style.backgroundImage=`url("${bg}")`;}

if(focus){const el=document.querySelector(`[data-focus="${focus}"]`);if(el){el.focus({preventScroll:true});if(typeof sel==='number'&&el.setSelectionRange)el.setSelectionRange(sel,sel);}}

}

function chatsView(){const q=search.trim().toLowerCase(),chats=state.chats.filter(ch=>title(ch).toLowerCase().includes(q)).slice().sort((a,b)=>(b.messages.at(-1)?.time||0)-(a.messages.at(-1)?.time||0));return header('聊天',state.ais.length?'每一段對話，都有溫度。':'在這裡，遇見你的日常陪伴。',btn('newChat','plus','建立新聊天或群組'))+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋聊天" aria-label="搜尋聊天"></div>`+(!state.ais.length?`<div class="empty">${drop()}<h2>等一個，想聊的人</h2><p>帶著名字與個性，來到沐水。<br>從一份角色檔案，開始你們的故事。</p><button class="pill primary" data-action="import">${icon('import')}　匯入 AI 角色</button><span class="small">支援 .JSON / .TXT 角色檔</span></div><div class="content"><div class="soft-note">${icon('heart')}　這裡還是一張白紙。<br>匯入後，你的 AI 會出現在聯絡人，等你開啟第一段對話。</div></div>`:!state.chats.length?`<div class="empty">${drop()}<h2>第一句，從你開始</h2><p>角色已在聯絡人等你。<br>點右上角「＋」選擇一位或多位 AI。</p><button class="pill primary" data-action="newChat">開啟新聊天</button></div>`:`<div class="content">${chats.length?chats.map(ch=>`<button class="chat-row" data-chat="${esc(ch.id)}">${chatAvatar(ch)}<div class="chat-info"><h3><span>${esc(title(ch))}${ch.members.length>1?' <span class="small">'+(ch.members.length+1)+' 人</span>':''}</span><time class="time">${ch.messages.length?ago(ch.messages.at(-1).time):''}</time></h3><p>${esc(ch.messages.at(-1)?.text||'輕輕說聲你好吧')}</p></div>${ch.unread?`<span class="badge">${ch.unread}</span>`:''}</button>`).join(''):'<p class="help">沒有符合的聊天。</p>'}</div>`);}

const contactPinyinCache=new Map();

function contactSort(name){

  const clean=String(name||'').trim();if(contactPinyinCache.has(clean))return contactPinyinCache.get(clean);

  const syllables=pinyinPro.pinyin(clean,{toneType:'none',type:'array',mode:'surname'}),key=syllables.join('').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  const first=(key[0]||'').toUpperCase(),letter=/^[A-Z]$/.test(first)?first:'#',result={key,letter};

  contactPinyinCache.set(clean,result);return result;

}

function contactSection(list,grouped=true){

 let last='';return list.slice().sort((a,b)=>{const x=contactSort(a.name),y=contactSort(b.name);return (x.letter==='#'?'~':x.letter).localeCompare(y.letter==='#'?'~':y.letter,'en')||x.key.localeCompare(y.key,'en');}).map(a=>{

 const letter=contactSort(a.name).letter;let section=grouped&&letter!==last?`<div class="letter" data-contact-letter="${letter}">${letter}</div>`:'';last=letter;

 return section+`<div class="contact-entry"><button class="contact-row" data-contact="${esc(a.id)}">${avatar(a)}<span>${esc(a.name)}</span>${a.specialStar?`<span class="person-mark" aria-label="星星">${icon('star')}</span>`:''}${a.favorite?`<span class="person-mark" aria-label="最愛">${icon('heart')}</span>`:''}</button><button class="contact-delete" data-deleteai="${esc(a.id)}" aria-label="刪除 AI ${esc(a.name)}">${icon('trash')}</button></div>`;

 }).join('');

}

function contactsView(){

 const categories=[...new Set(state.ais.map(a=>a.category).filter(Boolean))],query=search.trim().toLowerCase(),list=state.ais.filter(a=>(!query||a.name.toLowerCase().includes(query)||contactSort(a.name).key.includes(query))&&(filter==='全部'||a.category===filter)),favorites=list.filter(a=>a.favorite),others=list.filter(a=>!a.favorite);

 return header('聯絡人',`${state.ais.length} 位 AI · 按拼音 A–Z 排列`,btn('import','plus','匯入 AI 角色'))+`<div class="search">${icon('search')}<input data-input="search" data-focus="search" value="${esc(search)}" placeholder="搜尋名字或拼音" aria-label="搜尋聯絡人"></div><div class="content">${categories.length?`<div class="contact-tools">${categories.map(c=>`<button class="chip ${filter===c?'selected':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="small">再點一次分類可恢復完整列表。</p>`:''}${list.length?`${favorites.length?`<section class="contact-favorites" aria-label="最愛"><div class="favorites-title">${icon('heart')}<span>最愛</span></div>${contactSection(favorites,false)}</section>`:''}${contactSection(others)}`:`<div class="empty"><h2>${state.ais.length?'沒有符合的聯絡人':'還沒有聯絡人'}</h2><p>${state.ais.length?'試試其他分類，或搜尋另一個名字。':'點右上角匯入角色檔，讓熟悉的名字出現在這裡。'}</p></div>`}</div>`;

}

function momentsView(){return `<div style="position:relative"><div class="cover">${state.settings.cover?`<img src="${esc(state.settings.cover)}" alt="朋友圈封面">`:''}</div><header class="top moment-top"><div class="between"><h1>朋友圈</h1>${btn('compose','camera','發朋友圈')}</div></header></div><div class="moment-profile"><div style="text-align:right"><h3>${esc(state.settings.nickname||'我')}</h3><p class="small">${esc(state.settings.bio)}</p></div><button data-action="cover" aria-label="更換朋友圈封面">${avatar(person('me'),'large')}</button></div><div class="content">${state.moments.length?state.moments.slice().sort((a,b)=>b.time-a.time).map(p=>`<article class="moment">${avatar(person(p.author))}<div class="moment-main"><h3>${esc(person(p.author).name)}</h3><p class="text">${esc(p.text)}</p>${photos(p.images)}<div class="meta"><span>${ago(p.time)}</span><span class="spacer"></span>${p.author==='me'?`<button data-deletepost="${esc(p.id)}" aria-label="刪除朋友圈">${icon('trash')}</button>`:''}<button data-like="${esc(p.id)}" aria-label="${p.likes.includes('me')?'取消讚':'讚'}">${icon('heart')}${p.likes.includes('me')?' 已讚':''}</button><button data-comment="${esc(p.id)}" aria-label="留言">${icon('comment')}</button></div>${p.likes.length||p.comments.length?`<div class="comments">${p.likes.length?`<p class="accent">♡ ${p.likes.map(id=>esc(person(id).name)).join('、')}</p>`:''}${p.comments.map(c=>`<p><b>${esc(person(c.author).name)}：</b>${esc(c.text)}</p>`).join('')}</div>`:''}</div></article>`).join(''):`<div class="empty" style="padding-top:28px"><span class="accent">${icon('moments')}</span><h2 style="margin-top:18px;font-size:calc(19px * var(--text-scale,1))">把日常，留在這裡</h2><p>一張照片，或一點心情。<br>點右上角相機，分享第一則朋友圈。</p></div>`}</div>`;}

function photos(images){return images.length?`<div class="photos ${images.length===1?'single':''}">${images.map((img,i)=>`<button data-photo="${esc(img)}" aria-label="查看第 ${i+1} 張圖片"><img src="${esc(img)}" alt="朋友圈圖片" loading="lazy"></button>`).join('')}</div>`:'';}

function settingRow(id,ico,label,value=''){return `<button class="setting-row" data-page="${id}"><span class="setting-icon">${icon(ico)}</span><span class="label">${label}</span><span class="value">${esc(value)}</span><span class="chevron">›</span></button>`;}

function settingsView(){return header('設定','把沐水，變成你喜歡的樣子。',saveButton())+`<div class="content"><button class="profile-card full" style="text-align:left" data-page="profile">${avatar({name:draft.nickname||'我',avatar:draft.avatar,birthday:state.settings.birthday},'large')}<span><h2>${esc(draft.nickname||'我')}</h2><span class="small">${esc(draft.bio)}</span></span><span class="spacer"></span><span class="chevron">›</span></button><div class="section-label">專屬於你的陪伴</div><div class="card">${settingRow('api','cloud','模型與 API',draft.model)}${settingRow('memory','memory','記憶',draft.unifiedMemory?draft.memory+' 條 · 統一':'分別設定')}${settingRow('life','moments','AI 的日常',(draft.autoMessages||draft.autoMoments)?'已開啟':'由你決定')}</div><div class="section-label">通知與裝置</div><div class="card">${settingRow('notifications','chat','通知','訊息、來電、星星')}</div><div class="section-label">帳號同步與還原</div><div class="card"><button class="setting-row" data-action="accountSync"><span class="setting-icon">${icon('cloud')}</span><span class="label">帳號同步</span><span class="chevron">›</span></button>${settingRow('backup','cloud','備份與還原','JSON')}</div><div class="section-label">讓日常更像你</div><div class="card">${settingRow('appearance','palette','外觀',themes[draft.theme]?.name)}${settingRow('about','info','關於','2.1.5')}</div><p class="help">${dirty?'有尚未儲存的設定，請進入選項後儲存。':'角色、對話與記憶，安心留在這部裝置。'}</p><div class="footer-note">MUSHUI · 慢慢相遇，輕輕陪伴</div></div>`;}

const pageNames={api:'模型與 API',memory:'記憶',individual:'分別記憶',life:'AI 的日常',notifications:'通知與裝置',chat:'聊天',privacy:'隱私與安全性',help:'使用說明',appearance:'外觀',backup:'備份與還原',about:'關於',profile:'我的資料'};

function notificationPage(){return '<p class="help">通知與裝置設定正在載入。</p>';}

function settingsPage(){return `<header class="top"><div class="between"><div class="flex">${btn('back','back','返回')}<h2>${pageNames[page]||'設定'}</h2></div>${saveButton()}</div></header><div class="content">${page==='api'?apiPage():page==='memory'?memoryPage():page==='individual'?individualPage():page==='life'?lifePage():page==='notifications'?notificationPage():page==='chat'?chatSettingsPage():page==='privacy'?privacySettingsPage():page==='help'?helpPage():page==='appearance'?appearancePage():page==='backup'?backupPage():page==='profile'?profilePage():aboutPage()}</div>`;}

function apiPage(){const p=providers[draft.provider]||providers.ChatGPT,models=[...new Set([...modelList,...p.models])];return `<p class="help">選擇服務與文字模型，自動填入網址和模型名稱。所有欄位都能手動修改；修改後請儲存。</p><label>API 服務</label><div class="provider-grid">${Object.keys(providers).map(n=>`<button data-provider="${n}" class="${draft.provider===n?'selected':''}">${n}</button>`).join('')}</div><label>模型</label><div class="model-grid">${models.map(n=>`<button data-model="${esc(n)}" class="${draft.model===n?'selected':''}">${esc(n)}</button>`).join('')}</div><button class="link-button" data-action="models">${icon('cloud')}　${busy?'讀取中…':'從 API 讀取全部可用模型'}</button><p class="small">預設清單不代表帳號權限或即時可用性。讀取清單需先儲存金鑰；請選擇聊天模型；照片辨識須模型支援，生圖請至「照片與圖片生成」設定。</p><label for="apiUrl">API 基底網址</label><input id="apiUrl" data-field="baseUrl" value="${esc(draft.baseUrl)}" placeholder="https://api.openai.com/v1" type="url" autocapitalize="off" spellcheck="false"><label for="modelName">模型名稱（可自訂）</label><input id="modelName" data-field="model" value="${esc(draft.model)}" autocapitalize="off" spellcheck="false"><label for="apiKey">API 金鑰</label><input id="apiKey" data-input="apiKey" value="${esc(apiKeyDraft??'')}" type="password" autocomplete="off" placeholder="${state.settings.hasKey?'已加密儲存，留空保持原金鑰':'貼上你的 API 金鑰'}"><div class="api-key-row"><span class="small">${state.settings.hasKey?'金鑰已加密儲存；留空會保留原金鑰。':'金鑰由你提供，不含預付額度。'}</span><button class="link-button danger" data-action="clearKey">清除金鑰</button></div><p class="small provider-help">Claude 使用 Messages；GPT-6 系列使用 Responses；其餘使用 OpenAI 相容聊天格式。網址請填基底路徑，不需加上 /chat/completions 或 /messages。切換服務後請填入對應金鑰。</p>`;}

function toggle(key,label,help){return `<div class="toggle-row"><div><h3>${label}</h3><p>${help}</p></div><button class="switch ${draft[key]?'on':''}" data-toggle="${key}" role="switch" aria-checked="${!!draft[key]}" aria-label="${label}"></button></div>`;}

function memoryButtons(value,attr='data-memory'){const selected=limits.includes(+value)?+value:limits.reduce((best,n)=>Math.abs(n-(+value||87))<Math.abs(best-(+value||87))?n:best,limits[0]);return `<div class="memory-grid">${limits.map(n=>`<button ${attr}="${n}" class="${selected===n?'selected':''}">${n}</button>`).join('')}</div>`;}

function memoryPage(){return `<p class="help">記憶條數代表每次傳送給模型的最近訊息數，含雙方訊息。完整聊天仍保留在本機。條數越多，API 用量可能越高；仍受模型的上下文上限約束。</p><div class="card">${toggle('unifiedMemory','全部 AI 相同記憶條數','開啟套用共同條數；關閉使用各角色的設定。')}<label>共同記憶 · ${draft.memory} 條</label>${memoryButtons(draft.memory)}<p class="help">另保留 80 條，對應你常用的記憶長度。</p></div><div class="card">${settingRow('individual','memory','分別記憶',draft.unifiedMemory?'目前使用統一設定':'逐一調整')}</div><p class="help">長期記憶摘要可在「分別記憶」編輯或產生。產生摘要會將相關聊天與角色內容傳送至目前設定的 API。</p>`;}

function individualPage(){return `<p class="help">${draft.unifiedMemory?'目前統一記憶為開啟狀態。可先編輯各角色，關閉統一設定並儲存後，分別條數才會生效。':'點選角色，設定獨立記憶條數與長期摘要。'}</p><div class="card">${state.ais.length?state.ais.map(a=>`<button class="contact-row" data-memai="${esc(a.id)}">${avatar(a)}<div><h3>${esc(a.name)}</h3><span class="small">${a.memory} 條${a.summary?' · 已有長期記憶':''}</span></div><span class="spacer"></span>›</button>`).join(''):'<p class="help">先匯入 AI，才能設定分別記憶。</p>'}</div>`;}

function lifePage(){return `<p class="help">讓對話之外，也有一點生活的聲音。兩個開關預設關閉，可分別選擇。開啟後需要 API 金鑰與可用額度。</p><div class="card">${toggle('autoMessages','AI 主動傳訊息','依據近期互動與個性，決定是否傳來私訊。')}${toggle('autoMoments','AI 自動發朋友圈','讓 AI 依聊天內容、關係與當下時間分享心情。')}</div><div class="card"><h3>日常如何發生</h3><p class="help">不設固定上班、睡覺時段，任何時刻都有機會。系統約每 15 分鐘檢查一次，依近期互動調整觸發機會，再由模型根據聊天決定發私訊、朋友圈，或保持安靜；兩次 API 嘗試至少間隔 30 分鐘。</p><p class="help">Android 省電模式、裝置睡眠、無網路、廠商背景限制與強制停止仍可能延遲或停止背景工作；作業系統不允許 App 在裝置睡眠時保證執行。強制停止後需重新打開 App。即使模型決定不發文，仍可能產生 API 費用。</p><button class="pill" data-action="notifications">${icon('chat')}　允許訊息通知</button></div><p class="help">${state.activity?.lastSuccess?'最近成功：'+esc(new Date(state.activity.lastSuccess).toLocaleString('zh-TW')):'尚無背景分享紀錄。'}${state.activity?.lastError?'<br>最近錯誤：'+esc(state.activity.lastError):''}</p>`;}

function appearancePage(){return `<label>馬卡龍主題</label><div class="swatches">${Object.entries(themes).map(([id,t])=>`<button class="swatch ${draft.theme===id?'selected':''}" data-theme="${id}"><span style="background:${t.soft};border:1px solid ${t.accent}"></span>${t.name}</button>`).join('')}</div><p class="help">圓角、柔和陰影，還有輕盈回彈。主題可即時預覽，儲存後套用。</p>${[['appBg','App 背景','套用在聊天清單、聯絡人與設定。'],['chatBg','聊天背景','套用至所有未單獨設定的聊天室。'],['cover','朋友圈背景','你的朋友圈封面圖片。']].map(([key,label,help])=>`<div class="card"><h3>${label}</h3><p class="help">${help}</p>${draft[key]?`<img class="image-preview" src="${esc(draft[key])}" alt="${label}">`:''}<div class="flex"><button class="pill" data-imagefield="${key}">${icon('camera')}　選擇圖片</button><button class="link-button" data-resetimage="${key}">恢復預設</button></div></div>`).join('')}`;}

function helpPage(){const label=deviceLabel(),copy=label==='平板'?'平板版：允許通知以接收訊息與來電。iPadOS 會依系統規則暫停背景工作；定位只在授權後讀取。':label==='手機'?'手機版：允許通知與所需的相機、麥克風、定位權限。Android 可開啟背景服務與電池最佳化豁免；睡眠或關機仍會停止工作。':'電腦版：允許 Windows 通知；人類通話需麥克風權限與網路。電腦進入睡眠時程式無法繼續執行。';return `<div class="card"><h3>${label}使用說明</h3><p class="help">${copy}</p><p class="small">各權限可在「設定 → 通知」或相關功能中管理。AI 訊息、照片辨識、語音與記憶摘要會使用你自行設定的 API 服務。</p></div>`;}

function backupPage(){return `<div class="card"><h3>把重要的陪伴，收好</h3><p class="help">匯出角色、聊天紀錄、朋友圈、圖片、記憶與已儲存設定。JSON 備份含私人對話與圖片，請保存在可信任的位置。API 金鑰不會匯出。</p><button class="pill primary full" data-action="export">${icon('cloud')}　匯出 JSON 備份</button></div><div class="card"><h3>從備份回到這裡</h3><p class="help">還原會覆蓋目前裝置的全部角色、聊天、朋友圈與設定。請先匯出目前資料。還原後自動活動會關閉，現有金鑰保留；請檢查 API 服務後再開啟。</p><button class="pill full" data-action="restore">${icon('import')}　選擇備份並還原</button></div>`;}

function profilePage(){return `<div class="profile-edit"><button data-imagefield="avatar" aria-label="更換頭像">${avatar({name:draft.nickname||'我',avatar:draft.avatar},'large')}</button></div><p class="small" style="text-align:center">點擊頭像更換</p><label for="nickname">暱稱</label><input id="nickname" data-field="nickname" maxlength="40" value="${esc(draft.nickname)}"><label for="bio">個人簽名</label><textarea id="bio" data-field="bio" maxlength="160">${esc(draft.bio)}</textarea>`;}

function aboutPage(){return `<div class="version">${drop()}<h1>沐水</h1><p class="small">Mizuki · 2.1.6</p></div><div class="card hint-list"><h3 style="margin-bottom:18px">關於這份陪伴</h3><p>角色、聊天、圖片與記憶存於這部裝置。解除安裝會清除資料，請定期匯出備份。</p><p>使用 AI 回覆、背景活動與記憶摘要時，相關角色設定、對話與記憶會傳送給你設定的 API 服務。朋友圈圖片目前僅作本機展示，不會傳給模型。</p><p>API 金鑰以 Android Keystore 加密保存；JSON 備份不含金鑰。App 本身不收集遙測，也不提供雲端同步。</p><p>AI 內容由模型產生，可能不準確。API 使用額度及費用由你選擇的服務商收取，ChatGPT 等訂閱方案不一定包含 API 額度。</p><p>背景活動受 Android 系統排程限制；本版以文字模型聊天與文字 AI 朋友圈為主。你可以發照片或純文字朋友圈。</p><p>本 App 為獨立作品，介面參考常見通訊軟體的操作結構，與微信、Apple 或各 AI 服務商無隸屬關係。</p></div><div class="footer-note">讓日常，慢慢有了回音。</div>`;}

function chatView(){const ch=state.chats.find(c=>c.id===chatId);if(!ch){chatId='';return '';}const bg=ch.bg||state.settings.chatBg;let lastDay='';return `<main class="conversation"><header class="top">${btn('closeChat','back','返回聊天清單')}<div class="spacer"><h2>${esc(title(ch))}</h2><p class="small">${sending.has(chatId)?'對方正在輸入中…':ch.members.length>1?(ch.members.length+1)+' 位成員 · AI 群聊':'AI 角色 · '+esc(ai(ch.members[0]).name)}</p></div>${btn('chatOptions','more','聊天設定')}</header><section class="message-scroll" data-chat-id="${esc(chatId)}" aria-label="聊天訊息"><div class="message-list"><div class="day">對話僅儲存於此裝置 · ${ch.messages.length} 則訊息</div>${ch.messages.length?ch.messages.map(m=>{const day=date(m.time),head=day!==lastDay?`<div class="day">${day}</div>`:'';lastDay=day;const placeholder=m.virtualCard&&['送你一份虛擬禮物。','送你一個虛擬沐水紅包。','給你一筆虛擬沐水幣。'].includes(m.text)?'':m.text;return head+`<div class="message ${m.callEvent?'call-event ':''}${m.author==='me'?'mine':''}" data-message-id="${esc(m.id)}">${avatar(person(m.author))}<div class="message-body">${m.author!=='me'&&ch.members.length>1?`<div class="author">${esc(person(m.author).name)}</div>`:''}<div class="bubble">${esc(placeholder)}</div><div class="stamp">${time(m.time)}</div></div></div>`;}).join(''):'<div class="empty"><p>打聲招呼，開啟你們的故事。</p></div>'}${sending.has(chatId)?'<div class="typing">● ● ●　對方正在輸入中…</div>':''}${ch.error?`<div class="error-box">${esc(ch.error)}<br><button class="link-button" data-action="retry">重新嘗試這位 AI 的回覆</button></div>`:''}</div></section><form class="composer" id="messageForm"><textarea data-input="message" data-focus="message" aria-label="輸入訊息" placeholder="說點什麼…" rows="1" maxlength="10000">${esc(chatDrafts[chatId]||'')}</textarea><button class="icon-button" type="submit" ${sending.has(chatId)?'disabled':''} aria-label="傳送訊息">${icon('send')}</button></form></main>`;}

function applyChatBackground(){const ch=state?.chats.find(c=>c.id===chatId),el=$('.conversation');if(el&&ch){const bg=ch.bg||state.settings.chatBg;if(bg)el.style.backgroundImage=`url("${bg}")`;}}

const renderBase=render;render=function(){renderBase();applyChatBackground();};

function showModal(name,body,footer=''){modal={name};$('#overlay').innerHTML=`<div class="modal-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(name)}"><div class="handle"></div><div class="sheet-title"><h2>${esc(name)}</h2>${btn('closeModal','close','關閉')}</div>${body}${footer}<p id="modalError" class="inline-error" role="alert"></p></section></div>`;}

function closeModal(){modal=null;$('#overlay').innerHTML='';}

function modalError(e){const el=$('#modalError');if(el)el.textContent=e.message||e;else toast(e.message||e);}

function confirmModal(name,text,fn){showModal(name,`<p class="help">${esc(text)}</p><div class="sheet-actions"><button class="pill" data-action="closeModal">取消</button><button class="pill primary" data-action="confirm">確定</button></div>`);modal.confirm=fn;}

async function mutate(action,data={}){const r=await call('mutate',{action,...data});state=r.state;return r;}

async function pickImage(){const r=await call('pick',{kind:'image'});return r?.image;}

function importModal(){showModal('匯入 AI 角色',`<p class="help">選擇一份 JSON 或 TXT。檔名會成為 AI 的名字，檔案內容描述個性。匯入後可在聯絡人編輯角色。</p><pre>小沐.txt\n名字：小沐\n個性：溫柔、好奇，喜歡雨天和散步。\n說話自然，會記得我們的小約定。</pre><p class="help">JSON 範例（檔名：小沐.json）</p><pre>{\n  "name": "小沐",\n  "personality": "溫柔、好奇，喜歡雨天。",\n  "greeting": "今天過得怎麼樣？"\n}</pre><p class="small">亦支援含 data.description / personality 的常見角色卡。檔案需為 UTF-8，不支援圖片角色卡。</p><div class="sheet-actions"><button class="pill primary" data-action="pickImport">${icon('import')}　選擇檔案</button></div>`);}

function newChatModal(){if(!state.ais.length){toast('先匯入一位 AI，才能開始聊天');return;}showModal('新的對話',`<p class="help">選一位開始私聊，選多位建立群組。</p><label for="groupTitle">群組名稱（選填）</label><input id="groupTitle" maxlength="80" placeholder="例如：我們的小日常">${state.ais.map(a=>`<label class="contact-row">${avatar(a)}<span>${esc(a.name)}</span><span class="spacer"></span><input class="check" type="checkbox" name="members" value="${esc(a.id)}"></label>`).join('')}<div class="sheet-actions"><button class="pill primary" data-action="createChat">開始聊天</button></div>`);}

function contactModal(id){const a=ai(id);showModal('角色資料',`<div class="profile-edit"><button data-contactavatar="${esc(id)}" aria-label="更換角色頭像">${avatar(a,'large')}</button></div><label for="contactName">名字</label><input id="contactName" maxlength="80" value="${esc(a.name)}"><label for="contactPersonality">個性與角色設定</label><textarea id="contactPersonality">${esc(a.personality)}</textarea><label for="contactCategory">分類</label><input id="contactCategory" list="categoryOptions" maxlength="30" value="${esc(a.category)}" placeholder="朋友、家人、工作，或自訂分類"><datalist id="categoryOptions"><option>朋友</option><option>家人</option><option>工作</option>${[...new Set(state.ais.map(a=>a.category).filter(Boolean))].map(c=>`<option>${esc(c)}</option>`).join('')}</datalist><label class="flex"><input id="contactFavorite" type="checkbox" ${a.favorite?'checked':''}> 加入最愛</label><label class="flex"><input id="contactSpecialStar" type="checkbox" ${a.specialStar?'checked':''}> 特殊星星</label><p class="help">開啟後，僅在你明確允許並選擇提醒項目時，這位角色才會收到裝置事件訊息。</p><div class="sheet-actions"><button class="pill" data-startai="${esc(id)}">${icon('chat')}　聊天</button><button class="pill primary" data-savecontact="${esc(id)}">儲存角色</button></div><button class="link-button danger" data-deleteai="${esc(id)}">刪除角色與相關私聊</button>`);modal.aiId=id;modal.avatar=a.avatar;}

function memoryModal(id){const a=ai(id);showModal(a.name+'的記憶',`<label>記憶條數</label><div id="individualLimits">${memoryButtons(a.memory,'data-indlimit')}</div><label for="summaryText">長期記憶摘要（可編輯）</label><textarea id="summaryText" rows="8" placeholder="重要的約定、偏好，或你們共同的回憶…">${esc(a.summary)}</textarea><p class="help">摘要會與角色個性一起傳給模型，不會取代完整聊天。產生摘要需 API，會分批整理完整對話後合併。</p><div class="card appearance-lock-card"><h3>固定外觀</h3><p class="help">${a.appearance||'尚未建立外觀。可用下方功能依角色個性生成。'}</p><button class="pill" id="appearanceLockToggle" data-action="toggleAppearanceLock">${a.appearanceLocked?'ON · 外觀固定':'OFF · 可重新生成'}</button>${a.appearanceLocked?'':'<button class="pill" data-regenerateappearance="'+esc(id)+'">依個性重新生成外觀</button>'}<p class="small">固定時，聊天模型會持續沿用此描述；關閉後可重新生成，使用你設定的文字 API，可能產生費用。</p></div><button class="pill" data-summarize="${esc(id)}">${icon('memory')}　使用 API 產生摘要</button><div class="sheet-actions"><button class="pill primary" data-savememory="${esc(id)}">儲存這位 AI 的記憶</button></div>`);modal.aiId=id;modal.memory=a.memory;modal.appearanceLocked=!!a.appearanceLocked;}

function composeModal(){showModal('分享一點日常',`<textarea id="postText" data-input="postText" placeholder="這一刻，想留下什麼？" maxlength="5000" rows="5">${esc(posting.text)}</textarea><div class="photos" id="draftPhotos">${draftPhotos()}</div><p class="help">圖片最多 9 張，會在裝置內縮圖儲存。內容只保存在本機朋友圈。</p><div class="sheet-actions"><button class="pill primary" data-action="publish">發表</button></div>`);}

function draftPhotos(){return posting.images.map((img,i)=>`<div class="image-draft"><img class="full" style="aspect-ratio:1;object-fit:cover;border-radius:10px" src="${esc(img)}" alt="待發表圖片"><button data-removeimage="${i}" aria-label="移除圖片">×</button></div>`).join('')+(posting.images.length<9?'<button class="photo-add" data-action="postImage" aria-label="新增圖片">＋</button>':'');}

function chatOptions(){const ch=state.chats.find(c=>c.id===chatId);showModal('聊天設定',`<h3>${esc(title(ch))}</h3><p class="help">${ch.members.map(id=>esc(ai(id).name)).join('、')} ${ch.members.length>1?'與你':''}</p><div class="card"><h3>這段對話的背景</h3><p class="help">單獨設定的背景優先於全域聊天背景。</p><button class="pill" data-action="oneChatBg">選擇圖片</button>　<button class="link-button" data-action="resetChatBg">使用全域背景</button></div><button class="link-button danger" data-action="deleteChat">${icon('trash')}　刪除此聊天紀錄</button>`);}

function ensureDraft(){if(!draft){draft=structuredClone(state.settings);dirty=false;apiKeyDraft=null;}}

async function navigate(nextTab,nextPage=''){if(dirty&&nextTab!=='settings'){confirmModal('尚未儲存設定','要捨棄這次尚未儲存的設定，離開設定頁嗎？',()=>{dirty=false;draft=null;apiKeyDraft=null;closeModal();navigate(nextTab,nextPage);});return;}tab=nextTab;page=nextPage;chatId='';search='';if(tab==='settings')ensureDraft();render();}

window.goBack=function(){if(modal){closeModal();return true;}if(chatId){chatId='';render();return true;}if(page){page=page==='individual'?'memory':'';render();return true;}if(tab!=='chats'){navigate('chats');return true;}return false;};

// The one save routine for every settings page. It must also persist the independent image key:
// an override that dropped imageApiKey made "saved" image keys silently disappear (2.1.6 fix).
async function saveSettings(){if(busy)return;busy=true;try{const imageKey=typeof imageApiKeyDraft==='undefined'?null:imageApiKeyDraft;if(draft.useImageKey&&!imageKey&&!state.settings.hasImageKey)throw Error('已開啟獨立圖片金鑰，請先貼上金鑰並儲存');await mutate('settings',{settings:draft,...(apiKeyDraft!==null?{apiKey:apiKeyDraft}:{}),...(imageKey!==null?{imageApiKey:imageKey}:{})});draft=structuredClone(state.settings);dirty=false;apiKeyDraft=null;if(typeof imageApiKeyDraft!=='undefined')imageApiKeyDraft=null;render();const b=document.querySelector('[data-action="save"]');b?.classList.add('saved');toast('設定已儲存',850);setTimeout(()=>b?.classList.remove('saved'),450);}finally{busy=false;}}

async function sendMessage(retry=false){if(sending.has(chatId))return;const id=chatId,text=chatDrafts[id]||'';if(!retry&&!text.trim())return;sending.add(id);if(!retry)chatDrafts[id]='';render();try{const promise=call('send',{id,text,retry});setTimeout(async()=>{try{state=await call('load');if(chatId===id)render();}catch{}},350);const r=await promise;state=r.state;}catch(e){toast(e.message);try{state=await call('load');}catch{} }finally{sending.delete(id);render();}}

const actions={

 import:importModal,pickImport:async()=>{const r=await call('pick',{kind:'import'});if(r?.state){state=r.state;closeModal();render();toast('角色已匯入，去聯絡人打聲招呼吧');}},newChat:newChatModal,

 createChat:async()=>{const members=[...document.querySelectorAll('input[name=members]:checked')].map(e=>e.value),title=$('#groupTitle').value;const r=await mutate('newChat',{members,title});closeModal();chatId=r.chatId;render();},

 closeModal,back:window.goBack,closeChat:()=>{chatId='';render();},save:saveSettings,

 clearKey:()=>{apiKeyDraft='';dirty=true;$('#apiKey').value='';toast('金鑰將於儲存後清除');},

 models:async()=>{if(busy)return;busy=true;try{toast('正在讀取可用模型…');modelList=await call('models',{settings:draft});render();toast('已讀取 '+modelList.length+' 個模型；請選擇文字聊天模型');}finally{busy=false;}},

 compose:composeModal,postImage:async()=>{const image=await pickImage();if(image){posting.images.push(image);$('#draftPhotos').innerHTML=draftPhotos();}},

 publish:async()=>{if(busy)return;busy=true;try{await mutate('post',{text:posting.text,images:posting.images});posting={text:'',images:[]};closeModal();render();toast('這一刻，已經留下來了');}finally{busy=false;}},

 cover:async()=>{ensureDraft();await navigate('settings','appearance');},

 export:async()=>{const r=await call('export');if(r?.exported)toast('備份已匯出（不含 API 金鑰）');},

 restore:()=>confirmModal('還原並覆蓋本機資料','還原會覆蓋目前所有角色、聊天、朋友圈與設定。請先匯出目前資料。選好備份後會立即還原。',async()=>{const r=await call('pick',{kind:'restore'});if(r?.state){state=r.state;draft=structuredClone(state.settings);dirty=false;apiKeyDraft=null;imageApiKeyDraft=null;closeModal();render();toast('已還原，背景活動與自動生圖已關閉，請先檢查 API 設定');}}),

 notifications:async()=>{await call('notifications');toast('可在 Android 系統設定中管理沐水通知');},

 confirm:async()=>{if(modal?.confirm)await modal.confirm();},retry:()=>sendMessage(true),chatOptions,

 oneChatBg:async()=>{const image=await pickImage();if(image){await mutate('chatBg',{id:chatId,image});closeModal();render();}},resetChatBg:async()=>{await mutate('chatBg',{id:chatId,image:''});closeModal();render();},

 deleteChat:()=>{const id=chatId;confirmModal('刪除聊天','這段聊天紀錄會從裝置刪除，角色仍會保留。',async()=>{await mutate('deleteChat',{id});chatId='';closeModal();render();});}

};

document.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b||b.disabled)return;if(window.Native)window.Native.haptic();try{

if(b.dataset.tab){await navigate(b.dataset.tab);return;}if(b.dataset.page){page=b.dataset.page;render();return;}

if(b.dataset.action){await actions[b.dataset.action]?.();return;}

if(b.dataset.chat){chatId=b.dataset.chat;await mutate('readChat',{id:chatId});render();return;}

if(b.dataset.contact){contactModal(b.dataset.contact);return;}

if(b.dataset.filter){filter=filter===b.dataset.filter?'全部':b.dataset.filter;render();return;}

if(b.dataset.provider){const p=providers[b.dataset.provider];draft.provider=b.dataset.provider;if(!draft.customEndpoint)draft.baseUrl=p.url;draft.model=p.models[0];modelList=[];dirty=true;render();return;}

if(b.dataset.model){selectChatModel(b.dataset.model);dirty=true;render();return;}

if(b.dataset.toggle){if(b.dataset.toggle==='deviceEventsEnabled'&&!draft.deviceEventsEnabled){actions.confirmDeviceEvents?.();return;}if(b.dataset.toggle==='preciseLocation'&&!draft.preciseLocation){try{if(window.AndroidHost){const r=await call('preciseLocationPermission');if(!r.granted)throw Error('請允許精確定位');}else{if(!navigator.geolocation)throw Error('此裝置沒有可用的定位服務');const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));window.WebEngine&&(WebEngine.geo={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,timestamp:pos.timestamp});}draft.preciseLocation=true;dirty=true;render();toast('已取得精確位置讀值；尚未分享');}catch(err){toast(err.message||'無法取得定位');}return;}draft[b.dataset.toggle]=!draft[b.dataset.toggle];dirty=true;render();return;}

if(b.dataset.memory){draft.memory=Number(b.dataset.memory);dirty=true;render();return;}

if(b.dataset.theme){draft.theme=b.dataset.theme;dirty=true;render();return;}

if(b.dataset.imagefield){const image=await pickImage();if(image){draft[b.dataset.imagefield]=image;dirty=true;render();}return;}

if(b.dataset.resetimage){draft[b.dataset.resetimage]='';dirty=true;render();return;}

if(b.dataset.contactavatar){const image=await pickImage();if(image&&modal){modal.avatar=image;const a=ai(b.dataset.contactavatar);b.innerHTML=avatar({...a,avatar:image},'large');}return;}

if(b.dataset.savecontact){const personality=$('#contactPersonality').value.trim();if(!personality)throw new Error('個性不可空白');await mutate('contact',{id:b.dataset.savecontact,name:$('#contactName').value,personality,category:$('#contactCategory').value.trim(),favorite:$('#contactFavorite').checked,specialStar:$('#contactSpecialStar').checked,avatar:modal.avatar});closeModal();render();toast('角色已儲存');return;}

if(b.dataset.startai){const r=await mutate('newChat',{members:[b.dataset.startai],title:''});closeModal();chatId=r.chatId;render();return;}

if(b.dataset.deleteai){const id=b.dataset.deleteai;confirmModal('刪除角色','將刪除此角色和相關私聊，群組會移除這位角色。朋友圈保留，但角色名稱將顯示已移除。請先備份重要內容。',async()=>{await mutate('deleteAI',{id});closeModal();render();});return;}

if(b.dataset.memai){memoryModal(b.dataset.memai);return;}

if(b.dataset.indlimit){modal.memory=Number(b.dataset.indlimit);$('#individualLimits').innerHTML=memoryButtons(modal.memory,'data-indlimit');return;}

if(b.dataset.savememory){await mutate('contact',{id:b.dataset.savememory,memory:modal.memory,summary:$('#summaryText').value,appearanceLocked:!!modal.appearanceLocked});closeModal();render();toast('這位 AI 的記憶已儲存');return;}

if(b.dataset.action==='toggleAppearanceLock'){modal.appearanceLocked=!modal.appearanceLocked;const el=$('#appearanceLockToggle');if(el)el.textContent=modal.appearanceLocked?'ON · 外觀固定':'OFF · 可重新生成';const wrap=el?.parentElement;if(wrap){const regen=wrap.querySelector('[data-regenerateappearance]');if(regen)regen.remove();if(!modal.appearanceLocked)wrap.querySelector('p.small')?.insertAdjacentHTML('beforebegin',`<button class="pill" data-regenerateappearance="${esc(modal.aiId)}">依個性重新生成外觀</button>`);}return;}

if(b.dataset.regenerateappearance){const id=b.dataset.regenerateappearance;if(modal?.appearanceLocked)throw Error('先關閉固定外觀，再重新生成');const a=ai(id),text=await WebEngine.complete(state.settings,'依角色個性生成一份新的虛構角色外觀，列明髮型髮色、臉型、眼睛、膚色、身形、配件與常用衣著，不超過 800 字，只回外觀原文。',[{role:'user',content:a.name+'\n'+a.personality+'\n舊外觀（可自由替換）：'+(a.appearance||'尚未建立')}]);await mutate('contact',{id,appearance:text,appearanceLocked:false});memoryModal(id);toast('外觀已重新生成；喜歡後開啟固定並儲存');return;}

if(b.dataset.summarize){if(busy)return;busy=true;b.disabled=true;b.textContent='正在整理記憶…';try{const r=await call('summary',{id:b.dataset.summarize});state=r.state;if($('#summaryText'))$('#summaryText').value=ai(b.dataset.summarize).summary;toast('摘要已產生並儲存，可繼續編輯');}finally{busy=false;b.disabled=false;b.innerHTML=icon('memory')+'　使用 API 產生摘要';}return;}

if(b.dataset.like){await mutate('like',{id:b.dataset.like});render();return;}

if(b.dataset.comment){const id=b.dataset.comment;showModal('留句話',`<textarea id="commentText" placeholder="想說點什麼…" maxlength="1000"></textarea><div class="sheet-actions"><button class="pill primary" data-submitcomment="${esc(id)}">送出留言</button></div>`);return;}

if(b.dataset.submitcomment){await mutate('comment',{id:b.dataset.submitcomment,text:$('#commentText').value});closeModal();render();return;}

if(b.dataset.deletepost){const id=b.dataset.deletepost;confirmModal('刪除朋友圈','確定要刪除這則朋友圈和留言嗎？',async()=>{await mutate('deletePost',{id});closeModal();render();});return;}

if(b.dataset.photo){showModal('日常片刻',`<img class="photo-view" src="${esc(b.dataset.photo)}" alt="朋友圈圖片預覽">`);return;}

if(b.dataset.removeimage){posting.images.splice(Number(b.dataset.removeimage),1);$('#draftPhotos').innerHTML=draftPhotos();}

}catch(e){modalError(e);}});

document.addEventListener('input',event=>{const e=event.target;if(e.dataset.field){draft[e.dataset.field]=e.value;dirty=true;}if(e.dataset.input==='apiKey'){apiKeyDraft=e.value||null;dirty=true;}if(e.dataset.input==='search'){search=e.value;render();}if(e.dataset.input==='message'){chatDrafts[chatId]=e.value;e.style.height='43px';e.style.height=Math.min(e.scrollHeight,135)+'px';}if(e.dataset.input==='postText')posting.text=e.value;});

document.addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='messageForm')sendMessage();});

document.addEventListener('keydown',event=>{if(event.key==='Escape')window.goBack();if(event.target.dataset.input==='message'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();sendMessage();}});

async function refreshFromNative(){if(!state)return;try{const next=await call('load');if(JSON.stringify(next)!==JSON.stringify(state)){state=next;if(!modal&&tab!=='settings')render();}}catch{}}

window.refreshFromNative=refreshFromNative;

// Page refresh is manual; background jobs never replace the visible page.

async function boot(){try{state=await call('load');render();}catch(e){$('#app').innerHTML=`<div class="empty">${drop()}<h2>沐水</h2><p>${esc(e.message)}</p><button class="pill" data-action="reload">重新載入</button></div>`;actions.reload=boot;}}

boot();



function updateConversationFrame(html){

 const root=document.querySelector('#app'),old=root.querySelector('.conversation'),oldScroll=old?.querySelector('.message-scroll');

 if(!old||oldScroll?.dataset.chatId!==chatId){root.innerHTML=html;return;}

 const follow=!window.MizukiChatUserScrolling && oldScroll.scrollHeight-oldScroll.clientHeight-oldScroll.scrollTop<44,oldTop=oldScroll.scrollTop,viewTop=oldScroll.getBoundingClientRect().top,anchor=[...oldScroll.querySelectorAll('[data-message-id]')].find(node=>node.getBoundingClientRect().bottom>viewTop+1),anchorId=anchor?.dataset.messageId,anchorOffset=anchor?anchor.getBoundingClientRect().top-viewTop:0;

 const template=document.createElement('template');template.innerHTML=html;const next=template.content.querySelector('.conversation');if(!next){root.innerHTML=html;return;}

 // Never detach the iOS scroller in the middle of a gesture (WKWebView resets it to 0).
 // Rendering will be retried after the last touch/momentum scroll event.
 if(window.MizukiChatUserScrolling){window.MizukiDeferredChatRender=true;return;}
 const composer=old.querySelector('.composer'),nextComposer=next.querySelector('.composer');if(!composer||!nextComposer){root.innerHTML=html;return;}
 const freshScroll=next.querySelector('.message-scroll');
 if(oldScroll&&freshScroll){
   // Keep the original scroll element and its native gesture recognizer alive.
   oldScroll.innerHTML=freshScroll.innerHTML;
   oldScroll.className=freshScroll.className;
   freshScroll.replaceWith(oldScroll);
 }

 // Keep the focused textarea connected. Android must not dismiss/reopen its keyboard.

 const keep=new Set([composer,...old.querySelectorAll(':scope > .composer-menu, :scope > .sticker-panel')]);

 for(const child of [...old.children])if(!keep.has(child))child.remove();

 const panelBoundary=old.querySelector(':scope > .sticker-panel')||composer;

 for(const child of [...next.children])if(child!==nextComposer)old.insertBefore(child,panelBoundary);

 const field=composer.querySelector('textarea'),fresh=nextComposer.querySelector('textarea');if(field&&fresh&&field.value!==fresh.value)field.value=fresh.value;

 const send=composer.querySelector('[type=submit]'),freshSend=nextComposer.querySelector('[type=submit]');if(send&&freshSend)send.disabled=freshSend.disabled;

 const restore=()=>{const scroller=old.querySelector('.message-scroll');if(!scroller)return;if(follow)scroller.scrollTop=scroller.scrollHeight;else{const row=anchorId&&[...scroller.querySelectorAll('[data-message-id]')].find(node=>node.dataset.messageId===anchorId);scroller.scrollTop=row?scroller.scrollTop+row.getBoundingClientRect().top-scroller.getBoundingClientRect().top-anchorOffset:oldTop;}};

 restore();requestAnimationFrame(()=>{if(!window.MizukiChatUserScrolling)restore();});

}



;(()=>{const baseRender=render,positions=new Map();let renderedKey='';const key=()=>tab+'|'+page+'|'+chatId;render=function(){const old=document.querySelector('.page');if(old&&renderedKey)positions.set(renderedKey,old.scrollTop);const next=key();baseRender();requestAnimationFrame(()=>{const el=document.querySelector('.page');if(el)el.scrollTop=positions.get(next)||0;renderedKey=next;});};})();

