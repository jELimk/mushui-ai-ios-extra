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
 if(file.size>64*1024*1024)throw Error('檔案太大');const text=(await file.text()).replace(/^\uFEFF/,'');
 if(kind==='restore'){const s=JSON.parse(text);if(s.schema!==1||!Array.isArray(s.ais)||!Array.isArray(s.chats)||!Array.isArray(s.moments)||!s.settings)throw Error('備份格式不支援');const ids=new Set();for(const a of s.ais){if(!a.id||ids.has(a.id)||!a.name||!a.personality)throw Error('角色資料不完整');ids.add(a.id);}for(const c of s.chats){if(!c.members?.length||c.members.some(id=>!ids.has(id))||!Array.isArray(c.messages))throw Error('聊天角色不完整');for(const m of c.messages){W.images(m.images);if(m.sticker)m.sticker=W.sticker(m.sticker);}}for(const p of s.moments){W.images(p.images,9);if(p.visibleTo&&!Array.isArray(p.visibleTo))throw Error('朋友圈可見範圍無效');}
 W.migrate(s);for(const k of ['autoMessages','autoMoments','autoReactions','autoImages','autoIdentityImages','allowImageInvites','autoCalls','shareLocation'])s.settings[k]=false;s.activeCall=null;s.human.background=false;s.human.connected=false;W.running=false;W.epoch++;await W.key('human','');await W.edit(current=>{for(const k of Object.keys(current))delete current[k];Object.assign(current,s);});finish({state:await W.view(),restored:true});}
 else{if(!/\.(json|txt)$/i.test(file.name))throw Error('請選 JSON／TXT');finish(await W.mutate({action:'import',name:file.name,text}));}
 }catch(e){finish(null,e);}};input.click();
});
W.download=(name,text,type='application/json')=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
W.dispatch=async(op,d)=>{
 if(op==='microphone')return {granted:true};
 if(op==='voiceSession')return {};
 
 if(op==='voiceConfig'){W.url(d.url);if(!/^[A-Za-z0-9._-]{1,120}$/.test(d.model))throw Error('語音模型名稱無效');if(d.key!==undefined)await W.key('voice',d.key);await W.edit(s=>{s.settings.voiceBaseUrl=d.url;s.settings.voiceModel=d.model;});return {state:await W.view()};}
 if(op==='voiceNote'){await W.edit(s=>W.append(W.find(s.chats,d.id),'me','［通話語音轉寫］'+W.clean(d.text,10000)));return {};}
 if(op==='pick')return W.pick(d.kind);
 if(op==='notifications')return W.notifications();
 if(op==='load')return W.view();
 if(op==='mutate')return W.mutate(d);
 if(op==='send')return W.send(d);
 if(op==='human'||op==='rtcCredentials')throw Error('此獨立版不包含人類功能');
 if(op==='generate')return W.generate(d.id,d.aiId);
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


}
