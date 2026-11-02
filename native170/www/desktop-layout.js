 'use strict';

let desktopListSearch='',desktopListScroll=0;

function desktopChatList(){const saved=search;search=desktopListSearch;try{return chatsView().replaceAll('data-input="search"','data-input="desktopListSearch"').replaceAll('data-focus="search"','data-focus="desktopListSearch"');}finally{search=saved;}}

function desktopLayout(){if(window.DesktopDetached||innerWidth<700)return;const root=$('#app'),conversation=root.querySelector(':scope > .conversation'),mainPage=root.querySelector(':scope > .page');if(!conversation&&!mainPage)return;root.querySelector(':scope > .nav')?.remove();const shell=document.createElement('div');shell.className='desktop-shell';shell.innerHTML='<aside class="desktop-rail" aria-label="主要導覽">'+nav()+'</aside><aside class="desktop-sidebar" aria-label="聊天室清單"><div class="desktop-list-scroll">'+desktopChatList()+'</div></aside><section class="desktop-workspace" aria-label="目前的聊天室"></section>';const workspace=shell.querySelector('.desktop-workspace');if(conversation)workspace.append(conversation);else if(tab!=='chats'||page)workspace.append(mainPage);root.replaceChildren(shell);shell.querySelector('.desktop-list-scroll').scrollTop=desktopListScroll;for(const row of shell.querySelectorAll('[data-chat],[data-humanchat]')){const id=row.dataset.chat||'human:'+row.dataset.humanchat;row.classList.toggle('desktop-selected-chat',id===chatId);if(id===chatId)row.setAttribute('aria-current','true');}detachTools();birthdayNames();updateUnreadDots(state);const focus=document.querySelector('[data-focus="desktopListSearch"]');if(window.desktopSearchFocus&&focus){focus.focus({preventScroll:true});focus.setSelectionRange(focus.value.length,focus.value.length);window.desktopSearchFocus=false;}}

const layoutRender=render;// 3.0.7: the sidebar is rebuilt from HTML on every render, which used to drop the search box's focus after
// each letter. Keep the focused field (and caret) across the rebuild, and don't re-render while an input
// method is still composing (Chinese typing), only when the word is committed.
render=function(){const a=document.activeElement,f=a?.dataset?.focus,start=a?.selectionStart,end=a?.selectionEnd;layoutRender();desktopLayout();if(f&&document.activeElement?.dataset?.focus!==f){const el=document.querySelector(`[data-focus="${f}"]`);if(el){el.focus({preventScroll:true});try{if(typeof start==='number')el.setSelectionRange(start,end);}catch{}}}};
document.addEventListener('input',e=>{if(e.isComposing&&e.target?.dataset?.input==='search'){search=e.target.value;e.stopImmediatePropagation();}},true);
document.addEventListener('compositionend',e=>{if(e.target?.dataset?.input==='search')e.target.dispatchEvent(new Event('input',{bubbles:true}));},true);

document.addEventListener('scroll',e=>{if(e.target.classList?.contains('desktop-list-scroll'))desktopListScroll=e.target.scrollTop;},true);

document.addEventListener('input',e=>{if(e.target.dataset.input==='desktopListSearch'){desktopListSearch=e.target.value;window.desktopSearchFocus=true;render();}});

document.addEventListener('click',e=>{if(e.target.closest('[data-chat],[data-humanchat]')&&!window.DesktopDetached){tab='chats';page='';}},true);

document.addEventListener('keydown',e=>{if(e.key==='F5'||(e.ctrlKey&&e.key.toLowerCase()==='r')){e.preventDefault();actions.manualRefresh();}});

let resizeLayout;addEventListener('resize',()=>{clearTimeout(resizeLayout);resizeLayout=setTimeout(()=>{if(state&&!modal)render();},150);});

actions.desktopHelp=()=>showModal('Windows 使用說明',`<h3>單一 EXE</h3><p class="help">雙擊即可執行，無須安裝 Node.js、Python 或額外瀏覽器。程式會將聊天、圖片與設定儲存於 Windows 使用者的 AppData。請勿在程式仍運行時刪除資料；換版本只需更換 EXE，並先匯出 JSON 備份。</p><h3>聊天室與獨立視窗</h3><p class="help">左邊選聊天室，右邊閱讀與輸入；沒選擇時右側留空。把清單中的聊天室拖到程式外，或按聊天室右上角 ↗，可開啟多個獨立視窗。訊息共用同一份本機資料；真人通話集中在主視窗。</p><h3>通話與音效</h3><p class="help">先與同一伺服器上的好友互加，在人類聊天室按電話。接通後可開攝影機、選擇螢幕／視窗、靜音、開音效板。分享電腦聲音時會包含整台電腦的播放聲音。設定 → 語音、攝影機與設備，可選麥克風、耳機及鏡頭。Windows 隱私設定須允許桌面應用程式存取麥克風及攝影機。</p><h3>音效板</h3><p class="help">上傳支援的音檔，單段 0.1–60 秒／原檔最多 32 MB，轉為音量平衡 WAV。通話中播放會混入傳給對方的音訊；點停止可立即停播。選擇好友並一鍵同步，對方在「好友分享」按下載即可加入沐水，不會開啟瀏覽器。需要檔案時可按「下載檔案」另存 WAV。音效只在你選擇同步後上傳伺服器；請確認分享權利。</p><h3>帳號與備份</h3><p class="help">同一個伺服器、帳號及密碼登入，會恢復真人訊息，以及先前已上傳的 AI 內容。舊 Android／iPhone 的 AI 與個人頁面原本只存在手機，首次轉移請在舊機「設定 → 備份與還原」匯出 JSON，傳到電腦後在「設定 → 帳號同步與恢復 → 移入舊裝置 JSON 並同步」選取。未曾上傳的舊資料無法只靠登入恢復。API 金鑰、設備設定保留在本機，不會同步到朋友裝置。人類聊天由伺服器保存，管理員可讀取；AI 雲端同步使用密碼衍生金鑰及 AES-GCM 加密。離線後先保留本機資料，恢復連線後每 10 秒重試。伺服器必須保留磁碟及備份，請不要依賴唯一一份資料。已同步的訊息沒有自動到期刪除。帳號刪除會移除雲端內容。</p><h3>好友伺服器</h3><p class="help">EXE 包含完整桌面客戶端。真人通話、音效分享與跨裝置帳號同步仍需共同且持續運行的 HTTPS 伺服器；尚未配置時 AI 與本機聊天可獨立使用。新功能需更新伺服器程式並保留既有 MUSHUI_DATA；不必清空帳號。不同網路建議由管理員配置 TURN，否則部分網路無法通話。舊手機版尚未加入桌面同步與視訊，不能保證新功能互通。</p><h3>背景與刷新</h3><p class="help">關閉主視窗後程式留在通知區繼續工作，雙擊水滴可打開；通知區「完全退出」才停止所有視窗與服務。關機、睡眠、斷線會停止通話與 AI 排程。F5／Ctrl+R 可手動同步目前畫面，不會重載整個程式；新訊息只更新必要部分。AI 的所有請求僅在你設定服務並啟用相關功能後發生，可能產生服務商費用。</p>`);

if(state)render();



function desktopRosterKey(){return JSON.stringify({ais:state.ais.map(a=>[a.id,a.name,a.avatar,a.birthday]),chats:state.chats.map(c=>[c.id,c.title,c.members,c.avatar,c.pinned,c.messages.length,c.messages.at(-1)]),friends:humanData().friends,pins:humanData().pins,search:desktopListSearch});}

function updateDesktopSyncNotice(){const list=document.querySelector('.desktop-list-scroll');if(!list)return;let notice=list.querySelector('.account-sync-status');if(!humanData().connected){notice?.remove();return;}if(!notice){notice=document.createElement('button');notice.className='account-sync-status';notice.dataset.action='accountSync';list.querySelector('.top')?.after(notice);}const text=state.accountSync?.error?'帳號已登入 · AI 同步未完成':state.ais.length?state.ais.length+' 位 AI · 帳號同步狀態':'好友已登入 · 移入舊手機的 AI 與個人資料';if(notice.textContent!==text)notice.textContent=text;}

function refreshDesktopSidebar(){const list=document.querySelector('.desktop-list-scroll');if(!list)return;const key=desktopRosterKey();if(list.dataset.roster!==key&&!list.contains(document.activeElement)){const top=list.scrollTop;list.innerHTML=desktopChatList();list.dataset.roster=key;list.scrollTop=top;detachTools();birthdayNames();updateUnreadDots(state);for(const row of list.querySelectorAll('[data-chat],[data-humanchat]'))row.classList.toggle('desktop-selected-chat',(row.dataset.chat||'human:'+row.dataset.humanchat)===chatId);}updateDesktopSyncNotice();}

const syncedDesktopRender=render;render=function(){syncedDesktopRender();const list=document.querySelector('.desktop-list-scroll');if(list)list.dataset.roster=desktopRosterKey();updateDesktopSyncNotice();};

if(state)render();

