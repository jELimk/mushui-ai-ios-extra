'use strict';
if(window.WebEngine){
 const W=WebEngine,native=(method,args={})=>{if(!window.Capacitor?.nativePromise)throw Error('請從已安裝的 iPhone App 開啟');return Capacitor.nativePromise('MushuiLocal',method,args);};
 W.id=()=>{const b=crypto.getRandomValues(new Uint8Array(16));return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');};
 if(!crypto.randomUUID)crypto.randomUUID=W.id;
 W.get=async key=>(await native('get',{key})).value??undefined;
 W.put=async(key,value)=>{await native('put',{key,value});return value;};
 W.key=(slot,value)=>slot==='human'?Promise.resolve(''):native('secret',{slot,...(value===undefined?{}:{value})}).then(r=>r.value||'');
 const migrate=W.migrate;W.migrate=s=>{migrate(s);s.human={me:{},friends:[],requests:[],messages:[],cursor:0,background:false};s.chats=s.chats.filter(c=>!String(c.id).startsWith('human:'));return s;};
 const readView=W.view;W.view=async()=>{const s=await readView();s.human.connected=false;return s;};
 W.direct=async options=>{const u=new URL(options.url);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('API 網址需為 HTTPS');const r=await native('http',options);return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.data};};
 W.proxy=async(st,path,body,image=false,method='POST')=>{const secret=await W.key(image&&st.useImageKey?'image':'chat');if(!secret)throw Error('請先設定並儲存 API 金鑰');const headers=st.geminiNative?{'x-goog-api-key':secret}:st.provider==='Claude'?{'x-api-key':secret,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+secret};const r=await W.direct({url:W.url(st.baseUrl)+path,headers,method,body}),data=await r.json();if(!r.ok){const e=Error(('API HTTP '+r.status+'：'+(data?.error?.message||data?.error||'連線失敗')).replaceAll(secret,'[金鑰]'));e.status=r.status;throw e;}return data;};
 W.download=async(name,text,type='application/json')=>native('share',{name,text,type});
 W.notifications=()=>native('notifications');
 const dispatch=W.dispatch;W.dispatch=async(op,d)=>{
  if(op==='human'||op==='rtcCredentials')throw Error('此版沒有真人功能');
  if(op==='voiceSession')return {};
  if(op==='voiceTranscribe'){const s=await W.read(),base=s.settings.voiceBaseUrl||'https://api.openai.com/v1',key=await W.key('voice')||(new URL(base).origin===new URL(s.settings.baseUrl).origin?await W.key('chat'):'');if(!key)throw Error('請先設定語音辨識 API 金鑰');const r=await W.direct({url:W.url(base)+'/audio/transcriptions',headers:{Authorization:'Bearer '+key},transcription:true,audio:d.audio,model:s.settings.voiceModel||'whisper-1'}),data=await r.json();if(!r.ok||!data?.text?.trim())throw Error(('語音辨識失敗：'+(data?.error?.message||data?.error||'沒有文字')).replaceAll(key,'[金鑰]'));return {text:data.text.trim()};}
  if(op==='export'){const s=await W.read();delete s.human;await W.download('沐水AI備份.json',JSON.stringify(s,null,2));return {exported:true};}
  if(op==='locationPermission'){const r=await native('location');if(r.geo)W.geo=r.geo;return r;}
  return dispatch(op,d);
 };
}
