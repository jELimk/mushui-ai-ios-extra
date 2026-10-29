'use strict';
const aboutBeforePlatforms=aboutPage;
aboutPage=function(){return aboutBeforePlatforms().replace('App 本身不收集遙測，也不提供雲端同步。','App 不收集遙測。人類好友的帳號、訊息與圖片會保存在你選擇的伺服器；沒有端對端加密，伺服器管理者能存取。').replace('API 金鑰以 Android Keystore 加密保存',window.MushuiWeb?'API 金鑰以此瀏覽器的 WebCrypto 裝置金鑰加密保存':'API 金鑰以 Android Keystore 加密保存').replace('背景活動受 Android 系統排程限制',window.MushuiWeb?'iPhone 關閉 App 後，AI 自主活動會暫停；好友訊息由伺服器保存，主畫面 App 可授權 Web Push':'背景活動受 Android 系統排程限制');};
if(window.MushuiWeb){
 const apiBeforeWeb=apiPage;apiPage=function(){return apiBeforeWeb().replace('金鑰已存於 Android Keystore 加密保護的儲存區。','金鑰以此瀏覽器的 WebCrypto 裝置金鑰加密保存；請使用可信任的自架伺服器，API 請求經它轉送。');};
 const lifeBeforeWeb=lifePage;lifePage=function(){return lifeBeforeWeb().replace('通知欄有水滴圖標及停止按鈕','可在此停止持續陪伴').replace('Android 通知授權決定背景通知能否顯示。','iPhone 需安裝到主畫面並登入人類帳號後才可授權好友推播。').replace('背景省電、系統終止與強制停止仍可能中斷陪伴；重新進入後可再次開始。','AI 持續陪伴僅在 App 前景運行，隱藏或關閉後會暫停；好友訊息仍保存在伺服器，授權後可收到推播。');};
}

if(window.MushuiWeb)document.body.classList.add("web-platform");
