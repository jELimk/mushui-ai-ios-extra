'use strict';
window.MushuiAIExtra=true;document.body.classList.add('web-platform');
const aiAPI=apiPage;apiPage=function(){return aiAPI().replace('金鑰已存於 Android Keystore 加密保護的儲存區。','金鑰保存在 iPhone Keychain；App 直接連到你設定的 AI API，不經沐水伺服器。');};
aboutPage=function(){return `<div class="version">${drop()}<h1>沐水AI</h1><p class="small">1.6.1 · AI 專用額外版</p></div><div class="card hint-list"><p>此為獨立額外版，不納入正式版本更新。之後主線開發仍以原版 1.6.1 為基礎。</p><p>角色、聊天、圖片與記憶保存於 iPhone 本機；API 金鑰保存在 Keychain，JSON 備份不含金鑰。解除安裝會移除本機資料，請定期備份。</p><p>AI 聊天、照片辨識、生圖、語音辨識與摘要會直接傳送相關內容到你設定的 API 服務。不需沐水伺服器，App 不收集遙測。費用依所選 API 服務計算。</p><p>此版已移除人類帳號、好友、真人聊天與真人通話。AI 內容可能不準確；生成圖可能有外貌細節偏差。</p><p>iOS 切到背景、鎖屏或關閉時可能暫停 AI 自主排程，不能保證全天候背景訊息。AI 通話為錄音辨識、掛斷後文字回覆。</p></div>`;};
const aiLife=lifePage;lifePage=function(){return aiLife().replace('通知欄有水滴圖標及停止按鈕','可在此停止持續陪伴').replace('Android 通知授權決定背景通知能否顯示。','iPhone 通知由系統授權。').replace('這是 App 內電話功能授權。AI 可重複來電；接起立刻結束，留下已通話紀錄。沒有實際音訊、電信撥號或真實通話費用。','AI 可提出通話邀請；接通後持續錄音並辨識，掛斷後 AI 文字回覆。辨識內容會傳給你設定的語音 API。').replace('模擬電話不用電話、麥克風或聯絡人存取權限。','AI 語音訊息與通話需你授權麥克風。').replace('即使沒有發訊息，API 判斷仍可能計費。','即使沒有發訊息，API 判斷仍可能計費。iOS 自主排程需 App 可執行；背景、鎖屏與系統終止可能暫停。');};
const aiDraft=ensureDraft;ensureDraft=function(){aiDraft();};
if(state)render();
