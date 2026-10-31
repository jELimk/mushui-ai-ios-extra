'use strict';

if(!window.Native){

window.MushuiWeb=true;

window.WebEngine={id:()=>crypto.randomUUID(),running:false,geo:null,geoWatch:null,active:new Set(),epoch:0};

const W=window.WebEngine;

W.defaults=()=>({schema:1,ais:[],chats:[],moments:[],activity:{},settings:{keepAppearance:true,provider:'ChatGPT',baseUrl:'https://api.openai.com/v1',model:'gpt-4.1-mini',theme:'lilac',nickname:'我',bio:'讓日常，慢慢有了回音。',autoMessages:false,autoMoments:false,autoImages:false,autoIdentityImages:false,allowImageInvites:false,virtualCards:true,autoCalls:false,autoReactions:true,shareLocation:false,preciseLocation:false,customEndpoint:false,unifiedMemory:true,memory:87,textSize:100,font:'system',customFont:'',visionMode:'auto',imageProvider:'ChatGPT',imageBaseUrl:'https://api.openai.com/v1',liveBaseUrl:'https://api.openai.com/v1',imageModel:'gpt-image-1.5',useImageKey:false,deviceEventsEnabled:false,deviceEventTargets:[],deviceEventAppOpen:false,deviceEventBattery:false,deviceEventScreen:false,deviceEventIdle:false,deviceEventSpend:false,personVisibility:{},appBg:'',chatBg:'',cover:'',avatar:''},human:{serverUrl:location.origin,me:{},friends:[],requests:[],messages:[],cursor:0,background:false,lastError:''}});

W.db=new Promise((resolve,reject)=>{const r=indexedDB.open('mushui-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('無法使用本機儲存空間，請關閉私密瀏覽再試'));});

W.get=async key=>{const db=await W.db;return new Promise((resolve,reject)=>{const t=db.transaction('data'),r=t.objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});};

W.put=async(key,value)=>{const db=await W.db;return new Promise((resolve,reject)=>{const t=db.transaction('data','readwrite');t.objectStore('data').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(Error('本機儲存失敗，請備份並整理空間'));});};

W.migrate=s=>{const defaults=W.defaults(),normalizeMemory=value=>[19,27,87,278].includes(+value)?+value:[19,27,87,278].reduce((best,n)=>Math.abs(n-(+value||87))<Math.abs(best-(+value||87))?n:best,19);s.settings={...defaults.settings,...s.settings};s.settings.memory=normalizeMemory(s.settings.memory);s.human={...defaults.human,...s.human};for(const a of s.ais){a.appearance||='';a.cover||='';if(a.appearanceLocked===undefined)a.appearanceLocked=!!a.appearance;a.specialStar=!!a.specialStar;if(a.relationship===undefined)a.relationship=null;a.memory=normalizeMemory(a.memory);}for(const f of s.human.friends||[])f.specialStar=!!f.specialStar;return s;};

W.tail=Promise.resolve();

W.read=async()=>{await W.tail;return W.migrate(structuredClone(await W.get('state')||W.defaults()));};

W.edit=fn=>{const job=W.tail.then(async()=>{const s=W.migrate(structuredClone(await W.get('state')||W.defaults()));const result=await fn(s);if(new Blob([JSON.stringify(s)]).size>48*1024*1024)throw Error('本機資料已達 48 MB，請先備份並整理圖片');await W.put('state',s);return result;});W.tail=job.catch(()=>{});return job;};

W.keyLock=Promise.resolve();

W.key=(slot,value)=>{const job=W.keyLock.then(async()=>{let key=await W.get('device-key');if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await W.put('device-key',key);}if(value!==undefined){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));await W.put('secret-'+slot,{iv,cipher});return value;}const saved=await W.get('secret-'+slot);return saved?new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv},key,saved.cipher)):'';});W.keyLock=job.catch(()=>{});return job;};

W.find=(a,id)=>{const x=a.find(v=>v.id===id);if(!x)throw Error('找不到項目，可能已刪除');return x;};

W.visible=(p,id)=>{const hidden=id!=='me'&&p.author==='me'&&(typeof state!=='undefined'?state.settings?.personVisibility?.['ai:'+id]?.hideMoments:false);return !hidden&&(p.author===id||p.author==='official-mushui'||!p.visibleTo||p.visibleTo.includes(id));};

W.view=async()=>{if(!W.recovered){W.recovered=true;await W.edit(s=>{for(const p of s.moments)if(['queued','running'].includes(p.replyState)){p.replyState='error';p.replyError='上次回覆已中斷，可點重試。';}});}const s=await W.read();s.moments=s.moments.filter(p=>W.visible(p,'me'));s.settings.hasKey=!!await W.key('chat');s.settings.hasImageKey=!!await W.key('image');s.settings.voiceHasKey=!!await W.key('voice');s.human.connected=!!await W.key('human');s.lifeRunning=W.running;s.presence={time:Date.now(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,...W.geo};return s;};

W.url=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('網址需為 HTTPS 基底網址');return u.href.replace(/\/$/,'');};

W.clean=(v,max)=>{v=String(v??'').trim();if(v.length>max)throw Error('文字過長，最多 '+max+' 字');return v;};

W.images=(images,max=4)=>{images||=[];if(!Array.isArray(images)||images.length>max||images.some(i=>typeof i!=='string'||i.length>4*1024*1024||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(i)))throw Error('圖片格式無效或數量過多');return images;};

W.sticker=value=>{if(!value)return null;const m=/^(png|gif)-(\d{1,2})$/.exec(value.id||'');if(!m||+m[2]<1||+m[2]>(m[1]==='png'?41:8))throw Error('表情包不存在');return {id:m[1]+'-'+(+m[2]),pack:'jelee',name:(m[1]==='gif'?'動態表情 ':'表情 ')+(+m[2]),asset:'stickers/jelee/'+(m[1]==='gif'?'gif-':'')+(+m[2])+'.'+m[1]};};

W.append=(chat,author,text,extra={})=>{const m={id:W.id(),author,text,time:Date.now(),...extra};chat.messages.push(m);return m;};

W.dm=(s,id)=>{W.find(s.ais,id);let chat=s.chats.find(c=>c.members.length===1&&c.members[0]===id);if(!chat){chat={id:W.id(),title:'',members:[id],messages:[],bg:'',unread:0};s.chats.push(chat);}return chat;};

W.person=(s,id)=>id==='me'?s.settings.nickname:s.ais.find(a=>a.id===id)?.name||'已移除';

W.callBegin=(s,id,incoming)=>{if(!s.settings.autoCalls)throw Error('請先允許模擬電話');if(s.activeCall?.status==='ringing'&&Date.now()-s.activeCall.time<60000)throw Error('已有來電等待接聽');W.dm(s,id);s.activeCall={id:W.id(),aiId:id,incoming,time:Date.now(),status:'ringing'};if(!incoming)W.callEnd(s,s.activeCall.id,'answered');};

W.callEnd=(s,id,status)=>{const c=s.activeCall;if(!c||c.id!==id)throw Error('電話已結束');c.status=status;c.duration=0;c.endedAt=Date.now();W.append(W.dm(s,c.aiId),c.incoming?c.aiId:'me',status==='answered'?'☎ 已接聽 AI 來電，開始語音通話。談話內容以後續語音紀錄為準，勿虛構未記錄的對話。':status==='declined'?'☎ 已婉拒模擬電話，沒有接通。':'☎ 模擬電話未接聽。',{call:c});s.activeCall=null;};

W.relPresets={couple:['情侶','使用者的伴侶','AI 的伴侶'],brothers:['兄弟','使用者的兄弟','AI 的兄弟'],family:['家人','使用者的家人','AI 的家人'],sisters:['姐妹','使用者的姐妹','AI 的姐妹'],child:['子女','使用者的孩子','AI 的家長'],parent:['家長','使用者的家長','AI 的孩子'],friends:['朋友','使用者的朋友','AI 的朋友']};

W.mutate=async d=>{let chatId='',momentId='';

 if(d.action==='settings'){if(d.apiKey!==undefined)await W.key('chat',d.apiKey);if(d.imageApiKey!==undefined)await W.key('image',d.imageApiKey);}

 await W.edit(s=>{const st=s.settings,a=d.id?s.ais.find(a=>a.id===d.id):null;

 switch(d.action){

 case 'settings':if(d.settings.textSize!==undefined&&(!Number.isInteger(d.settings.textSize)||d.settings.textSize<85||d.settings.textSize>130||d.settings.textSize%5))throw Error('文字大小無效');W.url(d.settings.baseUrl);W.url(d.settings.imageBaseUrl);if(d.settings.liveBaseUrl)W.url(d.settings.liveBaseUrl);if(![19,27,87,278].includes(+d.settings.memory))throw Error('記憶條數無效');if(!d.settings.model.trim())throw Error('請填寫模型');if(d.settings.deviceEventsEnabled&&['AppOpen','Battery','Screen','Idle','Spend'].some(x=>d.settings['deviceEvent'+x])){const starOk=t=>{const [kind,id]=String(t).split(':',2),p=kind==='ai'?s.ais.find(x=>x.id===id):kind==='human'?s.human.friends.find(x=>x.id===id):null;return !!p?.specialStar;};const eventKeys=['deviceEventsEnabled','deviceEventTargets','deviceEventAppOpen','deviceEventBattery','deviceEventScreen','deviceEventIdle','deviceEventSpend'];const editing=eventKeys.some(k=>JSON.stringify(d.settings[k]??null)!==JSON.stringify(st[k]??null));const targets=d.settings.deviceEventTargets||[];if(editing){if(!targets.length)throw Error('請先標記並選擇至少一位星星');if(!targets.every(starOk))throw Error('提醒對象必須先標記為星星，或重新選擇');}else{const valid=targets.filter(starOk);d.settings={...d.settings,deviceEventTargets:valid};if(!valid.length)d.settings.deviceEventsEnabled=false;}}s.settings={...st,...d.settings};if(!s.settings.shareLocation&&W.geoWatch!==null){navigator.geolocation.clearWatch(W.geoWatch);W.geoWatch=null;W.geo=null;}delete s.settings.hasKey;delete s.settings.hasImageKey;break;

 case 'import':{const name=W.clean(d.name.replace(/\.(json|txt)$/i,''),80);if(!name||s.ais.some(a=>a.name===name))throw Error('檔名空白或角色同名');let personality=d.text,greeting='',appearance='';if(/\.json$/i.test(d.name)){let card=JSON.parse(d.text);card=card.data||card;personality=[card.personality,card.description,card.scenario,card.system_prompt].filter(Boolean).join('\n');greeting=card.first_mes||card.greeting||'';appearance=card.appearance||'';}if(!personality.trim())throw Error('個性內容不可空白');s.ais.push({id:W.id(),name,personality:W.clean(personality,100000),greeting,appearance:W.clean(appearance,5000),appearanceLocked:!!appearance,avatar:'',cover:'',memory:87,summary:'',favorite:false,category:'',relationship:null});break;}

 case 'contact':{if(!a)throw Error('找不到角色');if(d.appearance!==undefined&&a.appearanceLocked&&d.appearance!==a.appearance)throw Error('外觀已固定，請先在記憶中關閉固定外觀');for(const k of ['name','personality','category','favorite','specialStar','avatar','summary','memory','appearance','appearanceLocked'])if(d[k]!==undefined)a[k]=d[k];if(a.appearance&&d.appearanceLocked===undefined&&d.appearance!==undefined)a.appearanceLocked=true;break;}

 case 'deleteAI':s.ais=s.ais.filter(a=>a.id!==d.id);s.chats=s.chats.map(c=>({...c,members:c.members.filter(id=>id!==d.id)})).filter(c=>c.members.length);break;

 case 'newChat':{if(!d.members?.length)throw Error('至少選擇一位 AI');d.members.forEach(id=>W.find(s.ais,id));let c=d.members.length===1?s.chats.find(c=>c.members.length===1&&c.members[0]===d.members[0]):null;if(!c){c={id:W.id(),title:d.title||'',members:[...new Set(d.members)],messages:[],unread:0,bg:''};s.chats.push(c);if(c.members.length===1){const a=W.find(s.ais,c.members[0]);if(a.greeting)W.append(c,a.id,a.greeting);}}chatId=c.id;break;}

 case 'birthday':{const person=d.id==='me'?s.settings:W.find(s.ais,d.id);person.birthday=W.date(d.date);break;}

 case 'relationshipInvite':{W.respondInvite(s,d);break;}

 case 'noticeRead':{if(!['contacts','moments','settings'].includes(d.section))throw Error('通知分頁無效');s.noticeReads||={};s.noticeReads[d.section]=W.clean(d.signature,100);break;}

 case 'pinChat':{const c=W.find(s.chats,d.id);c.pinned=!c.pinned;break;}

 case 'readChat':W.find(s.chats,d.id).unread=0;break;

 case 'chatBg':W.find(s.chats,d.id).bg=d.image;break;

 case 'groupAvatar':{const c=W.find(s.chats,d.id);if(c.members.length<2)throw Error('僅群組可設定');if(d.image){W.images([d.image],1);c.avatar=d.image;}else delete c.avatar;break;}

 case 'deleteChat':s.chats=s.chats.filter(c=>c.id!==d.id);break;

 case 'blockAI':{const blocked=[...(st.blockedAI||[])];if(d.blocked){if(!blocked.includes(d.id))blocked.push(d.id);}else{const i=blocked.indexOf(d.id);if(i>=0)blocked.splice(i,1);}st.blockedAI=blocked;if(d.deleteConversation)s.chats=s.chats.filter(c=>!(c.members||[]).includes(d.id));break;}

 case 'poke':{const c=W.find(s.chats,d.id),actor=d.actor==='me'?'me':W.find(s.ais,d.actor).id;W.append(c,actor,d.text,{poke:true});if(actor!=='me')c.unread=(c.unread||0)+1;break;}

 case 'deleteHumanChat':{const h=s.human,peer=String(d.id);h.messages=h.messages.filter(m=>m.sender!==peer&&m.recipient!==peer);if(h.pins)delete h.pins[peer];break;}

 case 'setCover':W.images([d.image],1);st.cover=d.image;break;

 case 'post':{const text=W.clean(d.text,5000),images=W.images(d.images,9);if(!text&&!images.length)throw Error('寫點文字或選圖片');if(d.visibleTo)d.visibleTo.forEach(id=>{if(id!=='me')W.find(s.ais,id);});const p={id:W.id(),author:'me',text,images,spoilerImages:!!d.spoilerImages,time:Date.now(),likes:[],comments:[],...(d.visibleTo?{visibleTo:[...new Set(d.visibleTo)]}:{})};s.moments.push(p);momentId=p.id;break;}

 case 'officialReleasePost':{const version=W.clean(d.version,20),postId='official-release-'+version;if(s.moments.some(p=>p.id===postId))break;const text=W.clean(d.text,5000);if(!text)throw Error('更新內容不可空白');const p={id:postId,author:'official-mushui',text,images:[],time:Date.now(),likes:[],comments:[],official:true,release:true};s.moments.push(p);momentId=postId;break;}

 case 'comment':{const p=W.find(s.moments,d.id);if(!W.visible(p,'me'))throw Error('貼文不可見');const text=W.clean(d.text,1000);if(!text)throw Error('留言不可空白');p.comments.push({author:'me',text,time:Date.now()});momentId=p.id;break;}

 case 'like':{const p=W.find(s.moments,d.id);if(!W.visible(p,'me'))throw Error('貼文不可見');p.likes=p.likes.includes('me')?p.likes.filter(i=>i!=='me'):[...p.likes,'me'];break;}

 case 'deletePost':if(W.find(s.moments,d.id).author!=='me')throw Error('只能刪除自己的貼文');s.moments=s.moments.filter(p=>p.id!==d.id);break;

 case 'relationship':{if(!a)throw Error('找不到角色');if(d.unbind){a.relationship=null;break;}const p=W.relPresets[d.type];if(!p&&!d.label.trim())throw Error('請填寫自訂關係名稱');const label=p?.[0]||W.clean(d.label,40);a.relationship={type:d.type,label,aiRole:p?.[1]||W.clean(d.aiRole,80),userRole:p?.[2]||W.clean(d.userRole,80),callAi:W.clean(d.callAi,40),callUser:W.clean(d.callUser,40),notes:W.clean(d.notes,1000),since:a.relationship?.type===d.type&&a.relationship?.label===label?a.relationship.since:Date.now(),anniversary:W.date(d.anniversary??a.relationship?.anniversary??localDay()),updatedAt:Date.now()};break;}

 case 'imageInvite':{const c=W.find(s.chats,d.id),m=W.find(c.messages,d.messageId),i=m.imageInvite;if(!i||i.status!=='pending')throw Error('邀請已處理');if(d.dismiss)i.status='dismissed';else{const image=d.image||m.images?.[0];W.images([image],1);st[i.target]=image;i.status='accepted';}W.append(c,'me',d.dismiss?'這次先不更換，謝謝邀請。':'我接受了更換圖片的邀請。');break;}

 case 'virtualCard':{const c=W.find(s.chats,d.id),m=W.find(c.messages,d.messageId);if(m.virtualCard?.status!=='pending')throw Error('卡片已處理');m.virtualCard.status=d.decline?'declined':'accepted';W.append(c,'me',d.decline?'已婉拒這份虛擬心意。':'已收下這份虛擬心意。');break;}

 case 'call':W.callBegin(s,d.id,false);break;

 case 'answerCall':W.callEnd(s,d.id,d.decline?'declined':'answered');break;

 case 'cleanChatPhotos':for(const c of s.chats)for(const m of c.messages){if(m.images?.length){m.images=[];m.photosRemoved=true;}for(const f of m.files||[])if(/^video\//i.test(f.mime||'')){f.data='';f.audio=null;f.frames=[];f.mediaRemoved=true;}}for(const m of s.human.messages){if(m.images?.length){m.images=[];m.photosRemoved=true;}for(const f of m.files||[])if(/^video\//i.test(f.mime||'')){f.data='';f.audio=null;f.frames=[];f.mediaRemoved=true;}}break;

 default:throw Error('不支援的操作');

 }});

 if(momentId)await W.queueCircle(momentId);

 return {state:await W.view(),chatId,momentId};

};

}

