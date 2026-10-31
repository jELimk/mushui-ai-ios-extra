'use strict';



function individualPage(){

 return `<p class="help">${draft.unifiedMemory?'目前統一記憶為開啟狀態。關閉統一設定並儲存後，各角色的條數才會分別生效。':'點選角色可設定獨立記憶條數與長期摘要。'}</p><p class="help">「永遠保留外觀」可逐位 AI 開啟或關閉。開啟後沿用目前外觀描述；關閉後可重新生成或編輯，再開啟固定。</p><div class="card">${state.ais.length?state.ais.map(a=>`<div class="memory-contact-row"><button class="contact-row memory-contact-open" data-memai="${esc(a.id)}">${avatar(a)}<span><strong>${esc(a.name)}</strong><br><span class="small">${a.memory} 條 · ${a.summary?'已有長期記憶':'尚無摘要'}</span></span></button><button class="pill appearance-state ${a.appearanceLocked?'is-on':''}" data-appearance-toggle="${esc(a.id)}" aria-pressed="${!!a.appearanceLocked}">${a.appearanceLocked?'ON':'OFF'}</button></div>`).join(''):'<p class="help">先匯入 AI，才能設定分別記憶。</p>'}</div>`;

}



document.addEventListener('click',async e=>{

 const b=e.target.closest('[data-appearance-toggle]');if(!b)return;

 try{

  const id=b.dataset.appearanceToggle,a=ai(id),next=!a.appearanceLocked;

  if(next&&!String(a.appearance||'').trim())throw Error('這位 AI 還沒有外觀描述。先點名字進入記憶，輸入或生成外觀後再開啟。');

  await mutate('contact',{id,appearanceLocked:next});render();toast(next?'已固定這位 AI 的外觀':'已關閉外觀固定，可重新生成');

 }catch(err){toast(err.message||'外觀設定未完成');}

});



function helpPage(){

 const label=deviceLabel();

 const body=label==='平板'?`<h3>平板版使用說明</h3><p class="help">底部切換聊天、聯絡人、朋友圈與設定。點聯絡人或聊天右側的三點按鈕可開啟選項。聊天室支援照片、表情包、語音與已讀狀態。</p><p class="help">通知、麥克風、相機與定位會在首次使用時請求系統授權。iPadOS 可能暫停背景工作；鎖定畫面後不保證 AI 日常持續運行。</p><p class="help">設定 → 通知與裝置可管理通知、位置、星星及其它功能。設定 → 關於可再次查看本說明。</p>`:

  label==='手機'?`<h3>手機版使用說明</h3><p class="help">底部切換聊天、聯絡人、朋友圈與設定。點聯絡人或聊天右側的三點按鈕可開啟選項；聊天室支援照片、表情包、語音、回覆與訊息釘選。</p><p class="help">設定 → 模型與 API 填入你自己的服務網址、模型與 API 金鑰。金鑰留在本機加密空間。使用 AI 回覆、語音、摘要或圖片功能時，相關內容會送到你選擇的服務，可能產生費用。</p><p class="help">設定 → 通知與裝置可管理通知、定位、星星與其它功能。Android 可另外設定背景陪伴；iPhone 與 iPad 的背景執行受 iOS 系統限制。</p>`:

  `<h3>電腦版使用說明</h3><p class="help">左側選擇聊天室，右側閱讀與輸入。聊天室旁的三點按鈕可置頂或取消置頂；將聊天室拖出視窗可另開聊天室視窗。</p><p class="help">EXE 可直接執行。聊天與設定儲存在本機，好友訊息與跨裝置同步需要你登入同一個好友伺服器。API 金鑰留在這部電腦，不會隨帳號同步。</p><p class="help">設定 → 關於可查看本說明。Windows 通知、麥克風、攝影機及音訊設備會依 Windows 隱私設定授權；關閉視窗後可留在通知區，完全退出或讓電腦睡眠後不會繼續執行。</p>`;

 return `<section class="card device-help">${body}<p class="small">權限與背景執行方式會依裝置和作業系統版本不同。</p></section>`;

}



const aboutPageBeforeSettingsAdjustments=aboutPage;

aboutPage=function(){return aboutPageBeforeSettingsAdjustments()+`<div class="section-label">使用說明</div>${helpPage()}`;};





// Notification settings include a dedicated chat category for camera behavior and message-format help.

function chatSettingsPage(){return `<p class="help">聊天室內訊息與媒體的顯示方式。</p><div class="card"><h3>拍照</h3>${toggle('cameraAutoSaveToLibrary','拍照後自動保存到裝置','拍攝後仍會先加入待傳照片；開啟時另外保存一份到相簿或裝置照片資料夾。是否傳送仍由你按下傳送決定。')}</div><div class="card"><h3>訊息格式</h3><p class="help">設定聊天室文字、隱藏內容與引用格式的說明。</p><button class="setting-choice full" data-action="formatHelp">文字格式與隱藏內容說明　›</button></div>`;}

const notificationBeforeChatSettings=notificationPage;notificationPage=function(){return notificationBeforeChatSettings()+`<section class="card"><button class="setting-row" data-page="chat"><span class="setting-icon">${icon('chat')}</span><span class="label">聊天</span><span class="value">拍照與訊息格式</span><span class="chevron">›</span></button></section>`;};

const cameraBackCapturedBeforeDirect=actions.backCaptured;actions.backCaptured=async()=>{const c=CameraCapture;if(!c?.image)return;const {chat,image}=c;c.stream?.getTracks?.().forEach(t=>t.stop());CameraCapture=null;(photoDrafts[chat]||=[]).push(image);closeModal();if(draft?.cameraAutoSaveToLibrary)try{await saveImageToLibrary(image,'沐水拍攝照片.jpg');toast('照片已加入待傳並保存到裝置');}catch(e){toast('照片已加入待傳；保存失敗：'+(e.message||'請檢查照片權限'));}else toast('照片已加入待傳');if(chatId===chat)render();};

actions.clearCache=async()=>{confirmModal('清除快取與聊天媒體','聊天文字與記憶會保留；所有聊天室中的圖片和影片資料將從此裝置永久刪除，之後無法重新載入或辨識。建議先備份。',async()=>{await mutate('cleanChatPhotos');storageInfo=await call('clearCache');closeModal();render();toast('快取與聊天媒體已清除，文字和記憶已保留');});};

const storageViewBeforeMediaClear=storageView;storageView=function(){return `<div class="card"><h3>裝置內的陪伴</h3><p class="help">${storageInfo?`資料檔案：${size(storageInfo.dataBytes)}<br>暫存檔案：約 ${size(storageInfo.cacheBytes)}<br>聊天照片：${storageInfo.chatPhotos} 張`:'正在讀取儲存用量…'}</p><button class="link-button" data-action="refreshStorage">重新讀取用量</button></div><div class="card"><h3>清除快取</h3><p class="help">清理 App 暫存，並永久移除聊天室中的圖片與影片資料以釋放空間；所有文字訊息、記憶、角色、金鑰、頭像與背景都會保留。移除後媒體無法再載入或辨識。</p><button class="pill primary full" data-action="clearCache">${icon('trash')}　清除快取與聊天媒體</button></div><p class="help">自動摘要不會刪除本機文字聊天。本機資料上限仍為 48 MiB。</p>`;};

const humanChatBeforeInfoRemoval=chatView;chatView=function(){return humanChatBeforeInfoRemoval().replace(`${btn('formatHelp','info','文字格式說明')}`,'');};



function privacySettingsPage(){const me=humanData().me||{};return `<p class="help">帳號安全設定由你登入的好友伺服器保存。請勿與他人共用密碼。</p><div class="card"><h3>更改密碼</h3><label for="securityCurrentPassword">目前密碼</label><input id="securityCurrentPassword" type="password" autocomplete="current-password"><button class="pill" data-action="requestPasswordCode">寄送郵箱驗證碼</button><label for="securityPasswordCode">郵箱驗證碼</label><input id="securityPasswordCode" inputmode="numeric" autocomplete="one-time-code"><label for="securityNewPassword">新密碼</label><input id="securityNewPassword" type="password" autocomplete="new-password"><label for="securityConfirmPassword">確認新密碼</label><input id="securityConfirmPassword" type="password" autocomplete="new-password"><p class="small">需先綁定並驗證郵箱；驗證碼 10 分鐘有效。密碼長度為 8–128 個字元，更改後目前裝置保持登入。</p><button class="pill primary" data-action="changeAccountPassword">驗證並更新密碼</button></div><div class="card"><h3>綁定郵箱</h3><label for="securityEmail">電子郵件地址</label><input id="securityEmail" type="email" autocomplete="email" value="${esc(me.email||'')}" placeholder="name@example.com"><label for="securityEmailPassword">目前密碼</label><input id="securityEmailPassword" type="password" autocomplete="current-password"><button class="pill" data-action="bindAccountEmail">寄送驗證碼</button><label for="securityEmailCode">郵箱驗證碼</label><input id="securityEmailCode" inputmode="numeric" autocomplete="one-time-code"><p class="small">郵箱驗證後才可用於更改密碼。需由伺服器管理員設定 SMTP 郵件服務；驗證後可用於忘記密碼與更改密碼；郵箱不作為登入 ID。</p><button class="pill primary" data-action="verifyAccountEmail">驗證並綁定郵箱</button></div>`;}

actions.requestPasswordCode=async()=>{const currentPassword=document.querySelector('#securityCurrentPassword').value;if(!currentPassword)throw Error('請先輸入目前密碼');await call('human',{action:'requestPasswordCode',currentPassword});toast('驗證碼已寄到已驗證的郵箱');};

actions.changeAccountPassword=async()=>{const code=document.querySelector('#securityPasswordCode').value.trim(),newPassword=document.querySelector('#securityNewPassword').value,confirm=document.querySelector('#securityConfirmPassword').value;if(newPassword!==confirm)throw Error('兩次輸入的新密碼不一致');if(newPassword.length<8||newPassword.length>128)throw Error('新密碼需為 8–128 個字元');await call('human',{action:'changePassword',code,newPassword});document.querySelector('#securityPasswordCode').value='';document.querySelector('#securityNewPassword').value='';document.querySelector('#securityConfirmPassword').value='';toast('郵箱驗證成功，密碼已更新');};

actions.bindAccountEmail=async()=>{const email=document.querySelector('#securityEmail').value.trim(),password=document.querySelector('#securityEmailPassword').value;if(!email||!password)throw Error('請輸入郵箱與目前密碼');await call('human',{action:'bindEmail',email,password});toast('驗證碼已寄出，請查收郵箱');};

actions.verifyAccountEmail=async()=>{const email=document.querySelector('#securityEmail').value.trim(),code=document.querySelector('#securityEmailCode').value.trim();if(!email||!code)throw Error('請輸入郵箱與驗證碼');const r=await call('human',{action:'verifyEmail',email,code});state=r.state;render();toast('郵箱已驗證並綁定');};

const appearanceBeforeSeparateIcon=appearancePage;appearancePage=function(){const nameChoice=draft.appDisplayName||'system';return appearanceBeforeSeparateIcon()+`<div class="card"><h3>App 顯示名稱</h3><p class="help">選擇沐水啟動畫面與 App 內顯示的名稱；預設跟隨系統語言，英文系統顯示 Mizuki，也可以手動選擇沐水。</p><select data-field="appDisplayName" aria-label="App 顯示名稱"><option value="system" ${nameChoice==='system'?'selected':''}>跟隨系統</option><option value="mushui" ${nameChoice==='mushui'?'selected':''}>沐水</option><option value="mizuki" ${nameChoice==='mizuki'?'selected':''}>Mizuki</option></select></div>`;};

document.addEventListener('click',e=>{const b=e.target.closest('[data-icon-theme]');if(!b)return;draft.iconTheme=b.dataset.iconTheme;dirty=true;render();});

function applyDisplayAndIcon(){if(!state)return;const configured=state.settings.appDisplayName||'system',systemEnglish=(state.settings.uiLanguage||'system')==='en'||(state.settings.uiLanguage||'system')==='system'&&/^en(?:-|$)/i.test(navigator.language||'');const name=window.MizukiStaffEdition?'水沐':configured==='mizuki'||(configured==='system'&&systemEnglish)?'Mizuki':'沐水';document.title=name;document.querySelector('meta[name=apple-mobile-web-app-title]')?.setAttribute('content',name);document.querySelectorAll('.startup-name').forEach(el=>el.textContent=name);const iconTheme=themes[state.settings.iconTheme]||themes[state.settings.theme]||themes.lilac;const mark=document.querySelector('.startup-mark');if(mark){const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${iconTheme.soft}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="192" height="192" rx="56" fill="url(#g)"/><path d="M96 28C82 56 54 85 54 116a42 42 0 0 0 84 0c0-31-28-60-42-88Z" fill="${iconTheme.accent}"/><path d="M96 82c-9 18-20 31-20 45a20 20 0 0 0 40 0c0-14-11-27-20-45Z" fill="#fff" opacity=".92"/></svg>`;mark.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}document.documentElement.style.setProperty('--icon-bg',iconTheme.soft);document.documentElement.style.setProperty('--icon-accent',iconTheme.accent);document.documentElement.style.setProperty('--icon-deep',iconTheme.deep);}

// Display name and icon updates run through the render wrapper below.

const renderBeforeDisplayIcon=render;render=function(){if(state&&!window.MushuiAIOnly&&!state.human?.connected){$('#app').innerHTML=`<main class="login-gate"><div class="login-gate-card"><span class="app-icon-preview gate-icon"><i></i></span><p class="eyebrow">MUSHUI · 沐水</p><h1>請先登入</h1><p class="help">開始使用前，請先登入或註冊好友帳號。登入後才會開啟聊天、聯絡人與同步資料。</p><button class="pill primary full" data-action="humanAccount">前往登入／註冊</button><p class="small">AI 專用版不需要好友帳號。</p></div></main>`;applyDisplayAndIcon();return;}renderBeforeDisplayIcon();applyDisplayAndIcon();};



const chatSettingsBeforePrivacyLink=chatSettingsPage;chatSettingsPage=function(){return chatSettingsBeforePrivacyLink()+`${window.MushuiAIOnly?'':`<section class="card"><button class="setting-row" data-page="privacy"><span class="setting-icon">${icon('settings')}</span><span class="label">隱私與安全性</span><span class="value">密碼與郵箱</span><span class="chevron">›</span></button></section>`}`;};



if(state)render();

