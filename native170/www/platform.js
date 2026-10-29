if(window.MushuiDesktop){
 'use strict';
const aboutBeforePlatforms=aboutPage;aboutPage=function(){return aboutBeforePlatforms().replace('App 本身不收集遙測，也不提供雲端同步。','App 不收集遙測。同帳號的 AI 角色與聊天可加密同步；人類訊息及分享音效存於選定的好友伺服器，管理員可讀取，沒有端到端加密。').replace('API 金鑰以 Android Keystore 加密保存','API 金鑰以 Windows DPAPI 加密保存，不會上傳帳號同步').replace('背景活動受 Android 系統排程限制','關閉視窗後可在 Windows 通知區運行；完全退出、睡眠、關機與斷線會停止活動');};
const apiBeforeWeb=apiPage;apiPage=function(){return apiBeforeWeb().replace('金鑰已存於 Android Keystore 加密保護的儲存區。','金鑰使用 Windows DPAPI 加密儲存於目前使用者的本機資料；AI 請求直接連到你選定的 API 服務，不經好友伺服器。');};
const lifeBeforeWeb=lifePage;lifePage=function(){return lifeBeforeWeb().replace('通知欄有水滴圖標及停止按鈕','通知區有水滴圖標；可從此頁停止持續陪伴').replace('Android 通知授權決定背景通知能否顯示。','Windows 通知與專注模式決定是否顯示通知。').replace('背景省電、系統終止與強制停止仍可能中斷陪伴；重新進入後可再次開始。','關閉視窗後可留在 Windows 通知區繼續運行；完全退出、睡眠、關機、斷線會停止陪伴。重新開啟後可再次開始。');};
document.body.classList.add('desktop-platform');

}else{
 document.body.classList.add(window.AndroidHost?'android-platform':'web-platform');
 if(!window.AndroidHost){const api=apiPage;apiPage=function(){return api().replaceAll('Android Keystore','本機 WebCrypto 加密儲存');};const life=lifePage;lifePage=function(){return life()+'<p class="help">Safari 被暫停、關閉或鎖定後，無法保證持續 AI 活動或即時同步；重新開啟後會補同步。</p>';};}
}
