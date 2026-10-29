'use strict';
// Typing only changes the existing composer; no page render or focus replacement.
let composerIdleTimer,typingChat='',typingUntil=0,composingText=false;
function composerTools(){
 const form=document.querySelector('.composer');if(!form)return;
 if(!form.querySelector('.composer-tools')){const tools=document.createElement('div');tools.className='composer-tools';tools.setAttribute('aria-label','訊息附件工具');const buttons=[...form.querySelectorAll('button[type="button"]')];if(buttons.length){form.prepend(tools);buttons.forEach(b=>tools.append(b));}}
 const hide=typingChat===chatId&&performance.now()<typingUntil;setComposerTyping(hide);
}
function setComposerTyping(hide){const form=document.querySelector('.composer'),tools=form?.querySelector('.composer-tools');if(!form||!tools)return;form.classList.toggle('is-typing',hide);tools.inert=hide;tools.setAttribute('aria-hidden',String(hide));}
function typingActivity(){clearTimeout(composerIdleTimer);typingChat=chatId;typingUntil=performance.now()+1100;setComposerTyping(true);composerIdleTimer=setTimeout(()=>{if(composingText){typingActivity();return;}typingUntil=0;setComposerTyping(false);},1100);}
document.addEventListener('compositionstart',e=>{if(e.target.matches('.composer textarea')){composingText=true;typingActivity();}});
document.addEventListener('compositionend',e=>{if(e.target.matches('.composer textarea')){composingText=false;typingActivity();}});
document.addEventListener('input',e=>{if(e.target.id==='textSize'){draft.textSize=Number(e.target.value);dirty=true;applyTheme();document.querySelector('#textSizeValue').textContent=draft.textSize+'%';queueTextFades();}if(e.target.matches('.composer textarea'))typingActivity();});
document.addEventListener('focusout',e=>{if(e.target.matches('.composer textarea')&&!composingText){clearTimeout(composerIdleTimer);typingUntil=0;setComposerTyping(false);}});
const renderBeforePolish=render;render=function(){renderBeforePolish();composerTools();};
// No spinner page, fade-in or empty intermediate frame. An unchanged refresh preserves DOM.
let quietRefreshing=false,quietTimer;
function refreshSignature(value){const copy=structuredClone(value);if(copy?.presence)delete copy.presence.time;if(copy?.human)delete copy.human.lastSync;return JSON.stringify(copy,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);}
async function quietRefresh(moments=false){
 if(quietRefreshing||busy||humanSyncing)return;quietRefreshing=true;
 if(moments){momentsRefreshing=true;clearTimeout(pullStatusTimer);setPullStatus('正在刷新…');}else showPagePull('正在刷新…');
 const route=[tab,page,chatId,momentProfileId].join('|'),before=refreshSignature(state),scroller=document.querySelector('.page'),top=scroller?.scrollTop||0;
 try{if(humanData().connected)await call('human',{action:'sync'});const next=await call('load');if(route!==[tab,page,chatId,momentProfileId].join('|'))return;
 state=next;unreadSnapshot=next;
 if(before!==refreshSignature(next)){document.body.classList.add('quiet-refresh');clearTimeout(quietTimer);render();document.querySelector('.page,.conversation')?.classList.add('refreshed-page');const current=document.querySelector('.page');if(current)current.scrollTop=top;quietTimer=setTimeout(()=>document.body.classList.remove('quiet-refresh'),300);}
 updateUnreadDots(state);if(moments)setPullStatus('已刷新');else showPagePull('已刷新');
 }catch(e){if(moments)setPullStatus('刷新失敗，請重試');else showPagePull('刷新失敗，請重試');toast(e.message);}
 finally{quietRefreshing=false;momentsRefreshing=false;document.querySelector('.moments-pull-status')?.classList.remove('refreshing');pullStatusTimer=setTimeout(()=>setPullStatus(''),900);setTimeout(()=>showPagePull(''),900);}
}
actions.manualRefresh=()=>quietRefresh(false);actions.refreshMoments=()=>quietRefresh(true);
let pagePull=null,pagePullStatus,blockPullClickUntil=0;
function showPagePull(text){if(!pagePullStatus){pagePullStatus=document.createElement('div');pagePullStatus.className='page-pull-status';pagePullStatus.setAttribute('role','status');document.body.append(pagePullStatus);}pagePullStatus.textContent=text;pagePullStatus.classList.toggle('visible',!!text);}
document.addEventListener('touchstart',e=>{const t=e.touches[0];if(e.touches.length!==1||!state||(tab==='moments'&&!chatId)||page||modal||quietRefreshing||!e.target.closest('.page,.conversation')||e.target.closest('input,textarea,select,.composer,.sticker-panel,.chat-attachments'))return;const scroller=document.querySelector(chatId?'.message-scroll':'.page');if((scroller?.scrollTop||0)>1&&!e.target.closest('.conversation .top'))return;pagePull={x:t.clientX,y:t.clientY,distance:0};},{passive:true});
document.addEventListener('touchmove',e=>{if(!pagePull)return;if(e.touches.length!==1){pagePull=null;showPagePull('');return;}const t=e.touches[0],dy=t.clientY-pagePull.y,dx=t.clientX-pagePull.x;if(dy<0||Math.abs(dx)>Math.abs(dy)+8){pagePull=null;showPagePull('');return;}if(dy>10){if(e.cancelable)e.preventDefault();pagePull.distance=dy;showPagePull(dy>=70?'放開以刷新':'下拉刷新');}},{passive:false});
function endPagePull(cancelled){const g=pagePull;pagePull=null;if(!g)return;if(g.distance>10)blockPullClickUntil=performance.now()+500;if(!cancelled&&g.distance>=70)actions.manualRefresh();else showPagePull('');}
document.addEventListener('touchend',()=>endPagePull(false));document.addEventListener('touchcancel',()=>endPagePull(true));
document.addEventListener('click',e=>{if(performance.now()<blockPullClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
if(state)render();
// Fade only text that actually overflows; controls and complete text stay opaque.
const fadeTargets='.chat-info p,.chat-info h3>span,.moment-heading h1,.sheet-title h2,.conversation .top h2,.conversation .top .small,.setting-row .label,.setting-row .value';
function updateTextFades(){document.querySelectorAll(fadeTargets).forEach(el=>el.classList.toggle('fade-overflow',el.scrollWidth>el.clientWidth+1));}
let fadeFrame;function queueTextFades(){cancelAnimationFrame(fadeFrame);fadeFrame=requestAnimationFrame(updateTextFades);}
const fadeResize=new ResizeObserver(queueTextFades);fadeResize.observe(document.getElementById('app'));fadeResize.observe(document.getElementById('overlay'));
const modalBeforePolish=showModal;showModal=function(...args){modalBeforePolish(...args);queueTextFades();};
const renderBeforeFade=render;render=function(){renderBeforeFade();queueTextFades();};
window.addEventListener('resize',queueTextFades);document.fonts?.addEventListener('loadingdone',queueTextFades);queueTextFades();

actions.ownProfile=()=>{const p=person('me');showModal('我的個人頁面',`<div class="own-profile-card">${avatar(p,'large')}<h2>${esc(p.name)}</h2><p class="help">${esc(state.settings.bio||'還沒有填寫簡介')}</p><p class="small">生日：${esc(state.settings.birthday||'尚未設定')}</p></div><div class="sheet-actions"><button class="pill primary" data-action="editOwnProfile">編輯個人資料</button></div>`);if(birthdayToday(p))celebrate('balloons',p.name);};
actions.editOwnProfile=async()=>{closeModal();await navigate('settings','profile');};
/* Manual birthday entry and contact categories share the same themed sheet. */
birthdayModal=function(id){const p=id==='me'?person('me'):ai(id);showModal(p.name+'的生日',`<p class="help">直接輸入生日，不必逐年尋找。生日為選填，只會在當天顯示蛋糕、生日帽與氣球。</p><label for="birthdayValue">出生日期</label><input id="birthdayValue" class="birthday-text" type="text" inputmode="text" autocomplete="off" maxlength="10" placeholder="YYYY-MM-DD，例如 2000-02-29" value="${esc(p.birthday||'')}" aria-describedby="birthdayHelp"><p id="birthdayHelp" class="help">可輸入 2000-02-29 或 20000229。2 月 29 日只會在閏年當天觸發。</p><div class="sheet-actions"><button class="pill" data-action="clearBirthdayInput">清除日期</button><button class="pill primary" data-savebirthday="${esc(id)}">儲存生日</button></div><p class="small">生日只保存在這個 App 的本機資料。</p>`);};
actions.clearBirthdayInput=()=>{document.querySelector('#birthdayValue').value='';document.querySelector('#birthdayValue').focus();};
document.addEventListener('click',e=>{if(e.target.closest('[data-savebirthday]')){const input=document.querySelector('#birthdayValue'),v=input?.value.trim()||'';if(input)input.value=/^\d{8}$/.test(v)?v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6):v;}},true);
let categoryParent=null;
function syncCategoryLabel(){const input=document.querySelector('#contactCategory'),button=document.querySelector('[data-action=chooseContactCategory]');if(button&&input)button.querySelector('span').textContent=input.value||'未分組';}
const contactBeforeCategory=contactModal;contactModal=function(id){contactBeforeCategory(id);const input=document.querySelector('#contactCategory');if(input){input.removeAttribute('list');input.hidden=true;input.insertAdjacentHTML('afterend',`<button type="button" class="setting-choice full category-choice" data-action="chooseContactCategory"><span>${esc(input.value||'未分組')}</span><span class="chevron">›</span></button>`);}};
actions.chooseContactCategory=()=>{const input=document.querySelector('#contactCategory');if(!input)return;const current=input.value,choices=[...new Set(['朋友','家人','工作',...state.ais.map(a=>a.category),current].filter(Boolean))];categoryParent={node:document.querySelector('#overlay').firstElementChild,modal,scroll:document.querySelector('.sheet').scrollTop};showModal('選擇聯絡人分組',`<p class="help">選擇一個分組，或直接輸入新的分組名稱。返回角色資料後，按「儲存角色」才會保存。</p><div class="category-grid"><button class="pill ${!current?'selected':''}" data-categorychoice="">未分組</button>${choices.map(name=>`<button class="pill ${current===name?'selected':''}" data-categorychoice="${esc(name)}">${esc(name)}</button>`).join('')}</div><label for="newContactCategory">新增分組</label><input id="newContactCategory" maxlength="30" placeholder="例如：同學、遊戲夥伴"><div class="sheet-actions"><button class="pill" data-action="categoryBack">取消</button><button class="pill primary" data-action="useNewCategory">使用這個分組</button></div>`);modal.categoryPicker=true;};
function returnCategory(value){if(!categoryParent)return;const saved=categoryParent;categoryParent=null;document.querySelector('#overlay').replaceChildren(saved.node);modal=saved.modal;const sheet=document.querySelector('.sheet');sheet.style.animation='none';sheet.scrollTop=saved.scroll;if(value!==undefined)document.querySelector('#contactCategory').value=value;syncCategoryLabel();queueTextFades();}
actions.categoryBack=()=>returnCategory();actions.useNewCategory=()=>{const name=document.querySelector('#newContactCategory').value.trim();if(!name){modalError(Error('請輸入分組名稱，或選擇「未分組」'));return;}returnCategory(name);};
const closeBeforeCategory=closeModal;closeModal=function(){if(modal?.categoryPicker){returnCategory();return;}closeBeforeCategory();};const closeActionBeforeCategory=actions.closeModal;actions.closeModal=()=>{if(modal?.categoryPicker)returnCategory();else closeActionBeforeCategory();};
const returnBeforeCategory=returnFromRelationship;returnFromRelationship=function(...args){returnBeforeCategory(...args);syncCategoryLabel();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-categorychoice]');if(b)returnCategory(b.dataset.categorychoice);});
