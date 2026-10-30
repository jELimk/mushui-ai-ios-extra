'use strict';
// Runs before the main engine. Startup text stays hidden until the saved font is ready.
(function(){
 let saved=window.mushuiStartupFont;try{saved||=JSON.parse(localStorage.getItem('mushui-startup-font')||'null');}catch{}
 const selected=saved?.font||'system';let source=selected==='zpix'?'url("fonts/zpix.ttf")':null;
 async function custom(){if(saved?.customFont)return saved.customFont;return new Promise(resolve=>{const r=indexedDB.open('mushui-local',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('data'))r.result.createObjectStore('data');};r.onerror=()=>resolve('');r.onsuccess=()=>{const db=r.result,t=db.transaction('data'),q=t.objectStore('data').get('state');q.onsuccess=()=>{resolve(q.result?.settings?.customFont||'');db.close();};q.onerror=()=>{resolve('');db.close();};};});}
 async function apply(){try{if(selected==='custom'){const data=await custom();if(/^data:font\/(ttf|otf);base64,[A-Za-z0-9+/=]+$/.test(data)&&data.length<12000000)source='url("'+data+'")';}if(source){const face=await new FontFace('MushuiStartup',source).load();document.fonts.add(face);document.documentElement.style.setProperty('--startup-font','MushuiStartup,system-ui');}}catch{}finally{document.documentElement.classList.add('startup-font-ready');}}
 apply();
 window.cacheStartupFont=function(settings){try{localStorage.setItem('mushui-startup-font',JSON.stringify({font:settings.font||'system'}));}catch{}};
})();
