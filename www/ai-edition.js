'use strict';
window.MushuiAIExtra=true;document.body.classList.add('web-platform');
const aiAPI=apiPage;apiPage=function(){return aiAPI().replace('金鑰已存於 Android Keystore 加密保護的儲存區。','金鑰保存在 iPhone Keychain；App 直接連到你設定的 AI API，不經沐水伺服器。');};
const aiAbout=aboutPage;aboutPage=function(){return aiAbout().replace('1.6.1','1.6.1 · AI 專用額外版')+`<div class="soft-note">此版獨立於正式 1.6.1，不參與主線更新。只有 AI 功能，無人類帳號、好友、真人聊天或真人通話。內容隨 App 安裝，無需部署沐水伺服器；聊天／語音／生成圖依設定直接連 AI 服務。iOS 切到背景或鎖屏時可能暫停 AI 自主排程，不能保證全天候背景訊息。</div>`;};
const aiLife=lifePage;lifePage=function(){return aiLife().replace('通知欄有水滴圖標及停止按鈕','可在此停止持續陪伴').replace('Android 通知授權決定背景通知能否顯示。','iPhone 通知由系統授權。').replace('即使沒有發訊息，API 判斷仍可能計費。','即使沒有發訊息，API 判斷仍可能計費。iOS 自主排程需 App 可執行；背景、鎖屏與系統終止可能暫停。');};
const aiDraft=ensureDraft;ensureDraft=function(){aiDraft();};
if(state)render();
