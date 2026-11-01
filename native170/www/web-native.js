'use strict';

if(window.WebEngine){

const W=window.WebEngine;

W.normalize=(src,max=1600)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{const ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.83));}catch(e){reject(e);}};image.onerror=()=>reject(Error('無法讀取圖片'));image.src=src;});

W.pick=kind=>new Promise((resolve,reject)=>{

 const input=document.createElement('input');input.type='file';input.accept=kind==='image'?'image/*':kind==='font'?'.ttf,.otf':kind==='restore'?'.json':'.json,.txt';input.hidden=true;document.body.appendChild(input);let settled=false;

 const finish=(value,error)=>{if(settled)return;settled=true;input.remove();error?reject(error):resolve(value);};

 input.oncancel=()=>finish({});input.onchange=async()=>{try{const file=input.files?.[0];if(!file){finish({});return;}

 if(kind==='image'){if(file.size>30*1024*1024)throw Error('圖片太大');const url=URL.createObjectURL(file);try{finish({image:await W.normalize(url)});}finally{URL.revokeObjectURL(url);}return;}

 if(kind==='font'){if(file.size>8*1024*1024)throw Error('字體限 8 MB');const bytes=new Uint8Array(await file.arrayBuffer());if(!(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0)&&!['OTTO','true'].includes(String.fromCharCode(...bytes.slice(0,4))))throw Error('請選有效 TTF／OTF');const data=await new Promise((r,j)=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.onerror=j;reader.readAsDataURL(file);});finish({font:'data:font/ttf;base64,'+data,name:file.name});return;}

 if(file.size>(kind==='restore'?256:64)*1024*1024)throw Error('檔案太大');const text=(await file.text()).replace(/^\uFEFF/,'');

 if(kind==='restore'){const s=JSON.parse(text),desktopSounds=s.desktopSounds===undefined?null:await W.validateDesktopSounds(s.desktopSounds);delete s.desktopSounds;if(s.schema!==1||!Array.isArray(s.ais)||!Array.isArray(s.chats)||!Array.isArray(s.moments)||!s.settings)throw Error('備份格式不支援');const ids=new Set();for(const a of s.ais){if(!a.id||ids.has(a.id)||!a.name||!a.personality)throw Error('角色資料不完整');ids.add(a.id);}for(const c of s.chats){if(!c.members?.length||c.members.some(id=>!ids.has(id))||!Array.isArray(c.messages))throw Error('聊天角色不完整');for(const m of c.messages){W.images(m.images);if(m.sticker)m.sticker=W.sticker(m.sticker);}}for(const p of s.moments){W.images(p.images,9);if(p.visibleTo&&!Array.isArray(p.visibleTo))throw Error('朋友圈可見範圍無效');}

 W.migrate(s);for(const k of ['autoMessages','autoMoments','autoReactions','autoImages','autoIdentityImages','allowImageInvites','autoCalls','shareLocation'])s.settings[k]=false;s.activeCall=null;s.human.background=false;s.human.connected=false;W.running=false;W.epoch++;await W.key('human','');await W.edit(current=>{for(const k of Object.keys(current))delete current[k];Object.assign(current,s);});if(desktopSounds)await W.put('desktop-sounds',desktopSounds);finish({state:await W.view(),restored:true});}

 else{if(!/\.(json|txt)$/i.test(file.name))throw Error('請選 JSON／TXT');finish(await W.mutate({action:'import',name:file.name,text}));}

 }catch(e){finish(null,e);}};input.click();

});

W.download=(name,text,type='application/json')=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};

W.humanRequest=async(path,data,authorized=true)=>{

 const s=await W.read(),base=s.human.serverUrl||location.origin;if(new URL(base).origin!==location.origin)throw Error('Safari 版需使用目前 App 網址的好友伺服器');const headers={'Content-Type':'application/json'};if(authorized){const token=await W.key('human');if(!token)throw Error('請先登入人類帳號');headers.Authorization='Bearer '+token;}

 const r=await fetch(base.replace(/\/$/,'')+path,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data)}),value=await r.json();if(!r.ok)throw Error('好友伺服器 HTTP '+r.status+'：'+(value.error||'連線失敗'));return value;

};

W.humanSyncing=false;

W.humanSync=async()=>{if(W.humanSyncing)return;W.humanSyncing=true;try{

 for(let page=0;page<100;page++){

 const s=await W.read(),h=s.human,data=await W.humanRequest('/v1/sync?since='+(h.cursor||0));

 await W.edit(s=>{const h=s.human;if(h.me.id!==data.me.id)return;h.me=data.me;h.officialId=data.officialId||h.officialId||'mizuki';h.friends=data.friends.map(p=>({...p,favorite:h.friends.find(f=>f.id===p.id)?.favorite||false,specialStar:h.friends.find(f=>f.id===p.id)?.specialStar||false}));h.requests=data.requests;h.relationshipRequests=data.relationshipRequests||[];let known=null;for(const m of data.messages){if(+m.id>(h.cursor||0)){known??=new Map(h.messages.map((x,i)=>[String(x.id),i]));const at=known.get(String(m.id));if(at===undefined)h.messages.push(m);else h.messages[at]=m;h.cursor=+m.id;}}for(const u of data.readUpdates||[]){const sent=h.messages.find(m=>String(m.id)===String(u.id));if(sent)sent.readAt=u.readAt;}h.lastSync=Date.now();h.lastError='';});

 if(!data.hasMore)break;

 }

 }catch(e){await W.edit(s=>{s.human.lastError=e.message;});throw e;}finally{W.humanSyncing=false;}};

W.human=async d=>{

 if(d.action==='register'||d.action==='login'){

 const base=(['localhost','127.0.0.1'].includes(location.hostname)&&d.url.replace(/\/$/,'')===location.origin)?location.origin:W.url(d.url);if(new URL(base).origin!==location.origin)throw Error('Safari 版請使用目前 App 網址的伺服器');

 await W.edit(s=>{if(s.human.serverUrl!==base)s.human=W.defaults().human;s.human.serverUrl=base;});

 const data=await W.humanRequest('/v1/'+d.action,{id:d.userId,name:d.name,password:d.password,deviceName:d.deviceName||'未知裝置'},false);await W.key('human',data.token);await W.edit(s=>{s.human={...W.defaults().human,serverUrl:base,me:data.me};});await W.humanSync();return {state:await W.view()};

 }

 if(d.action==='requestPasswordCode'){await W.humanRequest('/v1/account/password/request',{currentPassword:d.currentPassword});return {sent:true};}

 if(d.action==='changePassword'){await W.humanRequest('/v1/account/password',{currentPassword:d.currentPassword,newPassword:d.newPassword});return {state:await W.view()};}

 if(d.action==='bindEmail'){return W.humanRequest('/v1/account/email',{email:d.email,password:d.password});}

 if(d.action==='verifyEmail'){const r=await W.humanRequest('/v1/account/email/verify',{email:d.email,code:d.code});await W.humanSync();return {state:await W.view(),email:r.email,verified:r.verified};}

 if(d.action==='devices'){return W.humanRequest('/v1/account/devices');}

 if(d.action==='blocks'){return W.humanRequest('/v1/blocks');}

 if(d.action==='blockPeer'){return W.humanRequest('/v1/blocks',{id:d.id,blocked:d.blocked!==false,deleteConversation:!!d.deleteConversation});}

 if(d.action==='deleteConversation'){return W.humanRequest('/v1/messages/conversation/delete',{id:d.id});}

 if(d.action==='logoutDevice'){const r=await W.humanRequest('/v1/account/devices/'+encodeURIComponent(d.id)+'/logout',{});if(r.current){try{const reg=await navigator.serviceWorker?.ready;await (await reg?.pushManager?.getSubscription())?.unsubscribe();}catch{}await W.key('human','');await W.edit(s=>{s.human.background=false;});}return r;}

 if(d.action==='logoutAllDevices'){const r=await W.humanRequest('/v1/account/devices/logout-all',{});try{const reg=await navigator.serviceWorker?.ready;await (await reg?.pushManager?.getSubscription())?.unsubscribe();}catch{}await W.key('human','');await W.edit(s=>{s.human.background=false;});return r;}

 if(d.action==='deleteAccount'){await W.humanRequest('/v1/account/delete',{password:d.password});await W.key('human','');await W.edit(s=>{s.human=W.defaults().human;});return {state:await W.view()};}

 if(d.action==='configure'){const url=W.url(d.url);if(new URL(url).origin!==location.origin)throw Error('Safari 版請使用目前 App 網址');await W.edit(s=>{s.human.serverUrl=url;});return {state:await W.view()};}

 if(d.action==='relation'){await W.humanRequest('/v1/relations/'+d.verb,d);await W.humanSync();return {state:await W.view()};}

 if(d.action==='rtc')return W.humanRequest(d.path,d.body);

 if(d.action==='search')return W.humanRequest('/v1/search?id='+encodeURIComponent(d.userId));

 if(d.action==='logout'){try{const r=await navigator.serviceWorker?.ready,sub=await r?.pushManager?.getSubscription();await sub?.unsubscribe();await W.humanRequest('/v1/logout',{});}catch{}await W.key('human','');await W.edit(s=>{s.human.background=false;});return {state:await W.view()};}

 if(d.action==='read'){await W.edit(s=>{s.human.reads||={};s.human.reads[d.id]=Math.max(s.human.reads[d.id]||0,Number(d.through)||0);});return {state:await W.view()};}

 if(d.action==='pin'){await W.edit(s=>{s.human.pins||={};s.human.pins[d.id]=!s.human.pins[d.id];});return {state:await W.view()};}

 if(d.action==='favorite'){await W.edit(s=>{const p=W.find(s.human.friends,d.id);p.favorite=!p.favorite;});return {state:await W.view()};}

 if(d.action==='specialStar'){await W.edit(s=>{const p=W.find(s.human.friends,d.id);p.specialStar=!!d.value;});return {state:await W.view()};}

 if(d.action==='background'){throw Error('iPhone 背景收訊請安裝主畫面並開啟推播');}

 if(d.action==='remove')await W.humanRequest('/v1/friends/remove',{id:d.id});

 else if(d.action==='request')await W.humanRequest('/v1/requests',{id:d.userId});

 else if(d.action==='accept'||d.action==='decline')await W.humanRequest('/v1/requests/'+d.action,{requestId:d.requestId});

 else if(d.action==='profile')await W.humanRequest('/v1/profile',{name:d.name,...(d.avatar!==undefined?{avatar:d.avatar}:{}),...(d.birthday!==undefined?{birthday:d.birthday}:{})});

 else if(d.action==='send'){const r=await W.humanRequest('/v1/messages',{to:d.id,text:d.text,images:W.images(d.images),sticker:W.sticker(d.sticker),clientId:d.clientMessageId,replyTo:d.replyTo||null,files:d.files||[],virtualCard:d.virtualCard||null,callEvent:!!d.callEvent,starEvent:!!d.starEvent,audio:d.audio||null,spoilerImages:!!d.spoilerImages});if(r?.message?.id){await W.edit(s=>{const h=s.human;if(!h.messages.some(m=>String(m.id)===String(r.message.id)))h.messages.push(r.message);});W.humanSync().catch(()=>{});return {state:await W.view()};}}

 else if(d.action!=='sync')throw Error('不支援的人類操作');

 await W.humanSync();return {state:await W.view()};

};

W.notifications=async()=>{

 if(window.MushuiNativeIOS||window.AndroidHost)return Desktop.invoke('notifications');

 if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('請使用支援推播的 Safari 主畫面 App（iOS 16.4 以上）');

 if(!await W.key('human'))throw Error('好友推播需要先登入人類帳號');

 const granted=await Notification.requestPermission();if(granted!=='granted')return {granted:false};

 const config=await fetch('/v1/config').then(r=>r.json());if(!config.pushKey)throw Error('伺服器尚未啟用推播，請先安裝 server/requirements.txt');

 const registration=await navigator.serviceWorker.ready,key=config.pushKey.replace(/-/g,'+').replace(/_/g,'/'),bytes=Uint8Array.from(atob(key+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));

 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});

 await W.humanRequest('/v1/push',{subscription:subscription.toJSON()});return {granted:true};

};

W.dispatch=async(op,d)=>{

 if(op==='microphone')return {granted:true};

 if(op==='voiceSession')return {};

 if(op==='rtcCredentials'){const s=await W.read();return {server:s.human.serverUrl,token:await W.key('human')};}

 if(op==='voiceConfig'){W.url(d.url);if(!/^[A-Za-z0-9._-]{1,120}$/.test(d.model))throw Error('語音模型名稱無效');if(d.key!==undefined)await W.key('voice',d.key);await W.edit(s=>{s.settings.voiceBaseUrl=d.url;s.settings.voiceModel=d.model;});return {state:await W.view()};}

 if(op==='voiceNote'){await W.edit(s=>W.append(W.find(s.chats,d.id),'me','［通話語音轉寫］'+W.clean(d.text,10000)));return {};}

 if(op==='voiceTranscribe'){const s=await W.read(),key=await W.key('voice')||(new URL(s.settings.voiceBaseUrl||'https://api.openai.com/v1').origin===new URL(s.settings.baseUrl).origin?await W.key('chat'):'');if(!key)throw Error('請先設定語音辨識 API 金鑰');const r=await fetch('/v1/proxy',{method:'POST',headers:{'Content-Type':'application/json','X-Mushui-Web-Session':await W.session()},body:JSON.stringify({url:W.url(s.settings.voiceBaseUrl||'https://api.openai.com/v1')+'/audio/transcriptions',headers:{Authorization:'Bearer '+key},transcription:true,audio:d.audio,language:'zh',prompt:'請用繁體中文逐字轉寫這段口語對話，保留原話與語氣，不要翻譯成其他語言。常見說法例如「你在幹嘛呀」。',model:s.settings.voiceModel||'whisper-1'})}),data=await r.json();if(!r.ok||!data.text?.trim())throw Error(('語音辨識失敗：'+(data.error?.message||data.error||'沒有文字')).replaceAll(key,'[金鑰]'));return {text:data.text.trim()};}

 if(op==='pick')return W.pick(d.kind);

 if(op==='notifications')return W.notifications();

 if(op==='load')return W.view();

 if(op==='mutate')return W.mutate(d);

 if(op==='send')return W.send(d);

 if(op==='human')return W.human(d);

 if(op==='generate')return W.generate(d.id,d.aiId,null,d.kind||'photo',true);

 if(op==='life')return W.life(d.start);

 if(op==='momentReplies'){await W.queueCircle(d.id);return {state:await W.view()};}

 if(op==='callStatus'){const s=await W.read();if(s.activeCall&&Date.now()-s.activeCall.time>=60000)await W.edit(s=>{if(s.activeCall)W.callEnd(s,s.activeCall.id,'missed');});const next=await W.read();return {activeCall:next.activeCall||null,lifeRunning:W.running};}

 if(op==='locationPermission')return new Promise(resolve=>{if(!navigator.geolocation){resolve({granted:false});return;}if(W.geoWatch!==null)navigator.geolocation.clearWatch(W.geoWatch);W.geoWatch=navigator.geolocation.watchPosition(p=>{W.geo={latitude:Math.round(p.coords.latitude*100)/100,longitude:Math.round(p.coords.longitude*100)/100,updatedAt:p.timestamp,accuracy:p.coords.accuracy};resolve({granted:true});},()=>resolve({granted:false}),{enableHighAccuracy:false,maximumAge:60000});});

 if(op==='export'){const s=await W.read();W.download('沐水備份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(s,null,2));return {exported:true};}

 if(op==='models'){const result=[];let path='/models';for(let page=0;page<50;page++){const r=await W.proxy(d.settings,path,null,false,'GET');for(const m of r.data||r.models||[])result.push((m.id||m.name).replace(/^models\//,''));if(!r.has_more||!r.last_id)break;path='/models?after_id='+encodeURIComponent(r.last_id);}return result;}

 if(op==='summary'){const s=await W.read(),a=W.find(s.ais,d.id);for(const c of s.chats.filter(c=>c.members.includes(d.id)))await W.compress(c.id,d.id,true);const current=await W.read(),summaries=current.chats.filter(c=>c.members.includes(d.id)).map(c=>c.memories?.[d.id]?.summary||'').join('\n');const summary=await W.complete(current.settings,'忠實合併角色聊天記憶；保留偏好、稱呼和重要事件，不改永久外貌與當前關係。'+W.system(a),[{role:'user',content:summaries||'尚無對話'}]);await W.edit(s=>{W.find(s.ais,d.id).summary=summary.slice(0,6000);});return {state:await W.view()};}

 if(op==='storage'||op==='clearCache'){if(op==='clearCache'){/* Keep the offline install shell, user data and keys. */}const s=await W.read();return {dataBytes:new Blob([JSON.stringify(s)]).size,cacheBytes:0,chatPhotos:s.chats.reduce((n,c)=>n+c.messages.reduce((v,m)=>v+(m.images?.length||0),0),0)+(s.human.messages||[]).reduce((n,m)=>n+(m.images?.length||0),0)};}

 throw Error('不支援的操作');

};

window.Native={haptic(){navigator.vibrate?.(8);},request(id,op,raw){Promise.resolve().then(()=>W.dispatch(op,JSON.parse(raw))).then(data=>window.nativeResult({id,ok:true,data}),error=>window.nativeResult({id,ok:false,error:error.message||'操作失敗'}));}};

if(!window.Desktop&&'serviceWorker'in navigator)navigator.serviceWorker.register('sw.js',{scope:'/'}).catch(()=>{});



window.addEventListener('load',()=>{const peer=new URLSearchParams(location.search).get('human');if(peer){let tries=0;const timer=setInterval(()=>{if(window.WebEngine&&typeof state!=='undefined'&&state){clearInterval(timer);tab='chats';page='';chatId='human:'+peer;render();}else if(++tries>40)clearInterval(timer);},250);}});

}

