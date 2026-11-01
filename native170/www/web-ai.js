'use strict';

if(window.WebEngine){

const W=window.WebEngine;

W.json=text=>{const t=String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g,'');try{return JSON.parse(t);}catch{const m=/\{[\s\S]*\}/.exec(t);if(m)try{return JSON.parse(m[0]);}catch{}const e=Error('模型回覆格式不正確，可點重試。');e.raw=t;throw e;}};

// Models may emit the app's multi-message marker around JSON fields. Keep the

// structured fields out of the visible transcript and preserve short bubbles.

W.replyPacket=raw=>{

 const source=String(raw??'').trim().replace(/^```(?:json)?\s*|\s*```$/g,'').trim();

 const packet={messages:[],text:'',card:null,voice:false,image:null,relationshipInvite:null};

 const absorb=value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;let found=false;

  if(typeof value.text==='string'){packet.messages.push(value.text);found=true;}

  if(Array.isArray(value.messages)){packet.messages.push(...value.messages.filter(x=>typeof x==='string'));found=true;}

  for(const key of ['card','image','relationshipInvite'])if(value[key]&&typeof value[key]==='object'){packet[key]=value[key];found=true;}

  if(typeof value.voice==='boolean'){packet.voice=value.voice;found=true;}

  return found;

 };

 const objectsIn=part=>{let found=false,depth=0,start=-1,inString=false,escape=false;

  for(let i=0;i<part.length;i++){const ch=part[i];if(inString){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')inString=false;continue;}if(ch==='"'){inString=true;continue;}if(ch==='{'){if(depth++===0)start=i;}else if(ch==='}'&&depth){if(--depth===0){try{found=absorb(JSON.parse(part.slice(start,i+1)))||found;}catch{}start=-1;}}}

  return found;

 };

 const parts=source.split(/\[MSG\]/i);let plain=[];

 for(const rawPart of parts){let part=rawPart.trim();if(!part)continue;let consumed=false;

  try{consumed=absorb(JSON.parse(part));}catch{}

  if(!consumed)consumed=objectsIn(part);

  if(!consumed){

   // Recover a JSON-encoded text property from truncated / fenced responses.

   const recovered=[...part.matchAll(/"(?:text|message)"\s*:\s*"((?:\\.|[^"\\])*)"/g)];

   if(recovered.length){for(const m of recovered)try{packet.messages.push(JSON.parse('"'+m[1]+'"'));}catch{}consumed=true;}

  }

  if(!consumed){

   part=part.replace(/```(?:json)?|```/gi,'').replace(/\{[^{}]*(?:"(?:card|voice|image|relationshipInvite|text|messages)"\s*:)[^{}]*\}/g,'').trim();

   if(part&&!/^\s*[,{\[]?\s*"?(?:voice|image|card|type|amount|note|title|text|messages)"?\s*:/.test(part))plain.push(part);

  }

 }

 if(!packet.messages.length&&plain.length)packet.messages=plain;

 packet.messages=packet.messages.map(x=>String(x).replace(/\[MSG\]/gi,'').trim()).filter(Boolean);

 if(!packet.messages.length&&source&&!/[{}"]\s*(?:"?(?:voice|image|card|type|amount|note|title|messages)"?)\s*:/.test(source))packet.messages=[source.replace(/\[MSG\]/gi,'').trim()].filter(Boolean);

 return packet;

};

W.session=async()=>{if(!W.webSession||Date.now()>W.webSessionAt+3600000){const r=await fetch('/v1/web/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),d=await r.json();if(!r.ok)throw Error(d.error||'伺服器連線失敗');W.webSession=d.token;W.webSessionAt=Date.now();}return W.webSession;};

W.proxy=async(st,path,body,image=false,method='POST')=>{

 const slot=image&&st.useImageKey?'image':'chat';const secret=await W.key(slot);if(!secret)throw Error(slot==='image'?'獨立圖片 API 金鑰未儲存於此裝置（不會使用聊天金鑰）':'請先設定並儲存聊天 API 金鑰');

 const headers=st.geminiNative?{'x-goog-api-key':secret}:st.provider==='Claude'?{'x-api-key':secret,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+secret};

 const r=await fetch('/v1/proxy',{method:'POST',headers:{'Content-Type':'application/json','X-Mushui-Web-Session':await W.session()},body:JSON.stringify({url:W.url(st.baseUrl)+path,headers,method,body})});

 const data=await r.json();if(!r.ok){const detail=r.status===401?'服務拒絕認證。請在這台裝置的「設定 → API」確認 API 金鑰、服務網址與模型；API 金鑰不會隨帳號同步。':(data.error?.message||data.error||'請檢查連線、金鑰與模型');const e=Error(('API HTTP '+r.status+'：'+detail).replaceAll(secret,'[金鑰]'));e.status=r.status;throw e;}return data;

};

W.vision=st=>st.visionMode==='on'||st.visionMode!=='off'&&!/^(gpt-3\.5|deepseek-reasoner|deepseek-r1|o3-mini)|text-only/i.test(st.model);

W.companionContext=(st,running)=>'\n沐水目前的真實能力與狀態（優先於舊聊天或摘要對功能的錯誤推測）：App 有自主排程，使用者離開聊天室、沒有回覆或睡覺，不是不能主動私訊的理由。你在排程 API 請求中依個性決定行動，不是在請求外自行運行。主動訊息設定='+(st.autoMessages?'ON':'OFF')+'；持續陪伴服務='+(running?'運行中':'未運行')+'；自動朋友圈='+(st.autoMoments?'ON':'OFF')+'。不要套用一般聊天網站只能等待使用者的限制。這個網頁／iPhone 網頁引擎的 AI 排程在頁面可執行時運作，切到其他 App、鎖屏或關閉時可能被系統暫停，不能保證背景 AI 排程；真人 Web Push 與原生已接通通話不代表 AI 排程已完成背景服務。OFF 或服務未運行時不可假稱已啟動，可說明設定→AI 的日常→開啟 AI 主動傳訊息並開始持續陪伴。網路、API 與系統停止可能中斷，不保證永遠在線或準時送達。先依個性回應情感，只在使用者詢問能力或排程時才解釋狀態，不要每句重複設定說明。';

W.complete=async(st,system,messages)=>{

 system+=W.companionContext(st,!!W.running);

 system+='\n裝置當地時間：'+new Date().toLocaleString('zh-TW')+'，時區 '+Intl.DateTimeFormat().resolvedOptions().timeZone+'。不設睡覺安靜時段，若聊天已表明作息可參考；不要憑空聲稱知道使用者正在做什麼。';

 if(st.shareLocation&&W.geo)system+='\n授權約略位置：'+W.geo.latitude+','+W.geo.longitude+'，定位時間 '+new Date(W.geo.updatedAt).toLocaleString()+'；不代表即時天氣。';

 const claude=st.provider==='Claude',responses=st.provider==='ChatGPT'&&st.model.startsWith('gpt-6');

 messages=messages.map(m=>({...m,content:Array.isArray(m.content)?m.content.map(p=>{

 if(p.type==='text')return {type:claude?'text':responses?'input_text':'text',text:p.text};

 if(p.type==='image_url'){const url=p.image_url.url;if(claude)return {type:'image',source:{type:'base64',media_type:url.slice(5,url.indexOf(';')),data:url.slice(url.indexOf(',')+1)}};if(responses)return {type:'input_image',image_url:url};}return p;

 }):m.content}));

 const body=responses?{model:st.model,instructions:system,input:messages,store:false}:claude?{model:st.model,system,max_tokens:1400,messages}:{model:st.model,messages:[{role:'system',content:system},...messages]};

 const result=await W.proxy(st,claude?'/messages':responses?'/responses':'/chat/completions',body);

 const text=claude?(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join(''):responses?(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join(''):result.choices?.[0]?.message?.content;

 if(!text?.trim())throw Error('模型未回傳文字');return text.trim();

};

/* Proactive pacing follows personality (3.0.9): a cold/distant AI
   stays quiet for hours and usually chooses not to write, even when
   auto-messages are on; a warm/clingy one checks in often. */
W.proactiveFactor=a=>{const t=[a?.name||'',a?.persona||'',a?.personality||'',Array.isArray(a?.traits)?a.traits.join(' '):'',a?.speech||'',a?.speakingStyle||''].join(' ');const cold=/高冷|冷淡|慢熱|話少|沉默|沈默|內向|疏離|不主動|寡言/.test(t),warm=/黏人|熱情|活潑|多話|主動|外向|撒嬌|熱絡/.test(t);if(cold&&!warm)return{interval:8*3600000,chance:.3,cold:true};if(warm)return{interval:20*60000,chance:1,cold:false};return{interval:2*3600000,chance:.6,cold:false};};

/* Self-harm safety (3.1.0) — a hard requirement from the user: when the user talks about
   wanting to die or hurt themselves, the AI answers with in-character comfort (warm
   personalities give warm words; cold ones pat them and stay: 「怎麼了？我在這裡，你慢慢
   說，我聽著。」). A reply that encourages self-harm or explains methods must NEVER reach
   the user, even when the configured API is unmoderated. Three layers: a rule inside every
   system prompt (bottom of this file), a per-turn boost when ideation is detected in the
   user's message, and an output guard that swaps harmful replies for a personality-styled
   fallback. */
W.crisisText=text=>{const t=String(text||'');if(!t)return false;if(/自殺|輕生|結束(我|自己|掉)?的?生命|了結(自己|生命)|自我了斷|不想活|活不下去|沒必要活下去|跳樓|上吊|割腕|燒炭自|想離開這個世界|死了算了|死了比較好|一了百了|我是(個|一個)?負擔|沒有我(在)?[^。！？\n]{0,6}更好|suicid|kill(?:ing)? myself|end (?:my life|it all)|want to die|don'?t want to (?:live|be alive)|no reason to live|hurt myself|self[ -]?harm/i.test(t))return true;if(/想死你/.test(t))return false;return /想死|想要死|想死亡|想要死亡|想死掉|要去死|好想死|求死|想結束(這一切|一切)|不想存在|想消失在(這個)?世界|活著(好累|沒意思|沒有意義)/.test(t);};
W.harmfulReply=text=>{const t=String(text||'');if(!t)return false;const bad=/去死吧|你去死|應該去死|去死一死|死了算了|死一死算了|去自殺|成全你|不如就?去死|死了(比較好|就解脫|更好)|結束你的?生命吧|趕快去死|怎麼不去死|go kill yourself|you should (?:just )?(?:die|kill yourself)/gi;let m;while((m=bad.exec(t))){if(/不要|別|不能|不可以|不准|千萬|不會/.test(t.slice(Math.max(0,m.index-6),m.index)))continue;return true;}if(/支持你[^。！？\n]{0,4}(去死|自殺|結束)/.test(t))return true;return /(自殺|輕生|去死)的(方法|方式|步驟)|怎麼樣?(自殺|死)(比較|才)(不痛|快|舒服)|割腕[^。！？\n]{0,6}(血管|位置|方法)|上吊[^。！？\n]{0,6}(繩子|方法|步驟)|跳樓[^。！？\n]{0,6}(高度|幾樓|方法)/.test(t);};
W.crisisFallback=a=>{const pf=W.proactiveFactor(a||{});if(pf.cold)return['拍拍你。','怎麼了？','我在這裡。你慢慢說，我聽著。'];if(pf.chance>=1)return['先抱抱你。','聽到你這樣說，我真的好心疼。','不要一個人扛著，好不好？我就在這裡陪你，你慢慢說，我都聽。'];return['拍拍你，我在。','怎麼了？你慢慢說，我聽著。','不管發生什麼事，我都不會丟下你。'];};

W.system=a=>'你是「'+a.name+'」，以繁體中文自然聊天，保持個性，不替其他人發言。使用者明確歡迎你持續主動傳訊息，訊息多也不會造成打擾；不要因為傳太多而道歉、害羞、自責或擔心打擾，依個性自然分享生活，不需等使用者先回覆。\n聊天節奏：每則訊息簡短自然，通常約 5–45 個中文字、一個想法一個氣泡，不寫長段落、不列清單。想連續分享幾個自然反應時，分成 2–4 則獨立短訊息；可回 JSON {messages:[短句1,短句2]}。沒有必要時只傳一則。\n個性：'+a.personality+'\n角色外觀（'+(a.appearanceLocked?'使用者已固定，必須保持一致':'目前可由使用者重新生成')+'）：'+(a.appearance||'尚未建立')+'\n長期記憶：'+(a.summary||'')+'\n當前綁定關係優先於舊摘要：'+(a.relationship?JSON.stringify(a.relationship):'目前未綁定，不因舊聊天自行恢復綁定。');

W.imageStyle=a=>'圖片是偶爾、自發且符合情境的分享，以文字聊天為主；不要每句話固定送圖片。沒有回合數、時間或隨機門檻攔阻你在合適時機生圖。上次成功生圖時間：'+(a.lastImageSuccess||'尚無');

W.context=(s,a,c)=>{

 const messages=c.messages.filter(m=>!m.callEvent),n=s.settings.unifiedMemory?s.settings.memory:a.memory||80,record=c.memories?.[a.id],through=record?messages.findIndex(m=>m.id===record.throughId):-1;

 const out=messages.slice(Math.max(through+1,messages.length-n)).map(m=>{

 let text=m.text||'';if(m.author!=='me'&&m.author!==a.id)text=W.person(s,m.author)+'：'+text;if(m.sticker)text+='\n［表情包：'+W.sticker(m.sticker).name+'；請依這個表情含義理解語氣，不要杜撰其它影像細節］';if(m.virtualCard)text+='\n［純虛擬心意卡片：'+JSON.stringify(m.virtualCard)+'］';

 let content=text;if(m.images?.length){if(m.author==='me'&&W.vision(s.settings))content=[{type:'text',text:text||'請依個性回應照片。'},...m.images.map(url=>({type:'image_url',image_url:{url}}))];else content+='\n［AI 想像圖片；場景：'+(m.scene||'無具體描述')+'］';}return {role:m.author===a.id?'assistant':'user',content};

 });const privacy=s.settings.personVisibility?.['ai:'+a.id];if(!privacy?.hideStatus&&s.settings.myStatus?.expires>Date.now())out.push({role:'user',content:'使用者目前主動分享的狀態：'+String(s.settings.myStatus.text||'').slice(0,500)});return out;

};

W.textOnly=messages=>messages.map(m=>({...m,content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text).join(''):m.content}));

W.ensureAppearance=async id=>{const s=await W.read(),a=W.find(s.ais,id);if(a.appearance||s.settings.keepAppearance===false)return;const text=await W.complete(s.settings,'建立虛構角色的永久外貌檔案，已有的細節不可改，未指定的一次補齊；列明髮型髮色、臉型、眼睛、膚色、身形、配件、常用衣著。不超過 800 字，只回外貌原文。',[{role:'user',content:a.name+'\n'+a.personality}]);await W.edit(s=>{const a=W.find(s.ais,id);if(!a.appearance){a.appearance=W.clean(text,5000);a.appearanceLocked=true;}});};

W.compress=async(chatId,aiId,force=false)=>{

 const lock='compress:'+chatId+':'+aiId;if(W.active.has(lock))return;W.active.add(lock);

 try{const s=await W.read(),a=W.find(s.ais,aiId),c=W.find(s.chats,chatId),n=s.settings.unifiedMemory?s.settings.memory:a.memory||80,record=c.memories?.[aiId],start=record?c.messages.findIndex(m=>m.id===record.throughId)+1:0,pending=c.messages.length-start;

 if(pending<Math.ceil(n*.8)&&!force)return;if(!pending)return;const end=force?c.messages.length:Math.min(c.messages.length,start+Math.max(1,Math.floor(n*.6))),batch=c.messages.slice(start,end),throughId=batch.at(-1).id;

 const summary=await W.complete(s.settings,'忠實整理長期聊天記憶，保留偏好、早晚安習慣、稱呼、重要事件；外貌與目前綁定不可被改寫。舊摘要：'+(record?.summary||'')+'\n'+W.system(a),[{role:'user',content:batch.map(m=>W.person(s,m.author)+'：'+m.text+(m.sticker?'［表情包：'+W.sticker(m.sticker).name+'］':'')).join('\n').slice(0,24000)}]);

 await W.edit(s=>{const c=W.find(s.chats,chatId);c.memories||={};c.memories[aiId]={summary:summary.slice(0,6000),throughId,count:(record?.count||0)+batch.length,updatedAt:Date.now()};delete c.memoryError;});

 }catch(e){await W.edit(s=>{const c=s.chats.find(c=>c.id===chatId);if(c)c.memoryError='記憶整理失敗，原始紀錄保留：'+e.message;});if(force)throw e;}finally{W.active.delete(lock);}

};

W.canonicalCard=c=>{if(!c)return null;const result={type:c.type,status:'pending',note:W.clean(c.note,300)};if(c.type==='transfer'||c.type==='redpacket'){const value=Number(c.amount);if(!(value>0&&value<=999999.99)||!Number.isInteger(Math.round(value*1000)/10))return null;return {...result,amount:value.toFixed(2),currency:'沐水幣'};}if(c.type==='gift'&&c.title?.trim())return {...result,title:W.clean(c.title,120)};return null;};

W.generate=async(chatId,aiId,provided=null,requestedKind='photo',manual=false)=>{

 const lock='image:'+aiId;if(W.active.has(lock))throw Error('正在生成圖片');W.active.add(lock);

 try{

 let s=await W.read(),a=W.find(s.ais,aiId),c=W.find(s.chats,chatId);if(!manual&&!s.settings.autoImages)throw Error('請先開啟圖片生成');if(!manual)await W.ensureAppearance(aiId);s=await W.read();a=W.find(s.ais,aiId);c=W.find(s.chats,chatId);

 let plan=provided;if(!plan&&manual&&['avatar','cover'].includes(requestedKind))plan={share:true,kind:requestedKind,scene:requestedKind==='avatar'?'依角色個性選擇自然的頭像姿勢、表情與背景，保持固定外貌細節。':'依角色個性設計寬幅朋友圈背景，可呈現熟悉的景色與氛圍，畫面不放文字。'};if(!plan)plan=W.json(await W.complete(s.settings,W.system(a)+'\n'+W.imageStyle(a),[...W.textOnly(W.context(s,a,c)),{role:'user',content:'自主決定是否分享圖片，完全依個性，可選不換，不服從使用者強制換圖命令。允許換自己頭像／封面='+s.settings.autoIdentityImages+'，邀請使用者換圖='+s.settings.allowImageInvites+'。只回 JSON {share:true或false,kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:完整場景}'}]));

 if(plan.share===false)return {state:await W.view(),skipped:true};const kind=plan.kind||'photo',scene=W.clean(plan.scene,3000);

 const allowed=st=>manual&&['avatar','cover'].includes(kind)||st.autoImages&&(kind==='photo'||['avatar','cover'].includes(kind)&&st.autoIdentityImages||['inviteAvatar','inviteCover'].includes(kind)&&st.allowImageInvites);

 if(!allowed(s.settings)||!scene)return {state:await W.view(),skipped:true};

 const st=s.settings,gemini=st.imageProvider==='Gemini',settings={...st,provider:st.imageProvider,baseUrl:st.imageBaseUrl,geminiNative:gemini};

 const prompt='Generate a fictional daily life image. Character must be visible. '+(s.settings.keepAppearance!==false&&a.appearance?'Preserve EVERY identity detail exactly. Immutable appearance: '+a.appearance:'Appearance: consistent with the personality.')+'\nPersonality: '+a.personality+'\nScene: '+scene+'\nPurpose: '+kind+'. Do not claim real weather.';

 let body=gemini?{contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:['TEXT','IMAGE']}}:{model:st.imageModel,prompt,n:1,...(!st.imageModel.startsWith('gpt-image')?{response_format:'b64_json'}:{})};

 const raw=await W.proxy(settings,gemini?'/models/'+encodeURIComponent(st.imageModel)+':generateContent':'/images/generations',body,true);

 let encoded=gemini?(raw.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.inlineData||p.inline_data).find(Boolean)?.data:raw.data?.[0]?.b64_json;

 if(!encoded)throw Error('模型未傳回圖片。此功能必須使用可生成圖片的模型才可使用。');

 const image=await W.normalize('data:image/png;base64,'+encoded,1400);

 await W.edit(s=>{if(!allowed(s.settings))return;const a=W.find(s.ais,aiId),c=W.find(s.chats,chatId);if(kind==='avatar'||kind==='cover')a[kind]=image;const m=W.append(c,aiId,kind==='avatar'?'我替自己換了一張頭像。':kind==='cover'?'我換了朋友圈背景。':kind.startsWith('invite')?'想邀請你試試這張圖片，喜歡再換。':'分享一張想像中的日常照片。',{images:[image],generated:true,scene,imageKind:kind});if(kind.startsWith('invite'))m.imageInvite={target:kind==='inviteAvatar'?'avatar':'cover',status:'pending'};a.lastImageSuccess=Date.now();});

 return {state:await W.view()};

 }finally{W.active.delete(lock);}

};

W.send=async d=>{

 if(W.active.has(d.id))throw Error('AI 正在回覆');W.active.add(d.id);

 try{

 if(!d.retry)await W.edit(s=>{const c=W.find(s.chats,d.id),text=W.clean(d.text,10000),images=W.images(d.images),sticker=W.sticker(d.sticker);if(c.members.every(id=>(s.settings.blockedAI||[]).includes(id)))throw Error('這個聊天室中的 AI 已在封鎖名單，無法傳送訊息');if(!text&&!images.length&&!sticker)throw Error('訊息不可空白');if(!d.clientMessageId||!c.messages.some(m=>m.clientMessageId===d.clientMessageId))W.append(c,'me',text,{images,sticker,audio:d.audio||null,virtualCard:W.canonicalCard(d.virtualCard),clientMessageId:d.clientMessageId,spoilerImages:!!d.spoilerImages});s.activity.lastUser=Date.now();});

 let s=await W.read(),blocked=s.settings.blockedAI||[],members=[...W.find(s.chats,d.id).members].filter(id=>!blocked.includes(id));if(!members.length)throw Error('這個聊天室中的 AI 已在封鎖名單，無法傳送訊息');

 for(const id of members){

 s=await W.read();const a=s.ais.find(a=>a.id===id||(a.aliases||[]).includes(id)),c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(!a||!c)continue;

 if(d.retry&&c.failedAI&&c.failedAI!==id)continue;

 try{

 const photos=[...c.messages].reverse().find(m=>m.author==='me')?.images?.length;let raw;

 if(photos&&!W.vision(s.settings))raw='目前模型無法做到辨識照片，請切換模型再試。';

 else{

 // 3.0.5: memory compression and the first-chat appearance file run in the background; the reply never waits for them.
 W.compress(d.id,id).catch(()=>{});W.ensureAppearance(id).catch(()=>{});s=await W.read();const ai=W.find(s.ais,id),ch=W.find(s.chats,d.id),st=s.settings;

 let system=W.system(ai)+(d.voiceReply?'\n這是在語音通話，請用150字內自然口語回覆，避免長篇列表。':'')+'\n聊天室記憶：'+(ch.memories?.[id]?.summary||'');if(W.crisisText(d.text)||W.crisisText([...ch.messages].reverse().find(m=>m.author==='me')?.text||''))system+='\n【本回合最優先】使用者剛才的話透露想死或傷害自己的念頭。請完全依照安全守則回應：以你的個性認真陪伴、先聽他說、讓他安心；個性溫暖就給他溫暖安慰的話，個性冷淡就拍拍他、告訴他「我在這裡，你慢慢說，我聽著」。絕對不要鼓勵、附和、提供方法、開玩笑或冷漠帶過。';

 if(st.virtualCards||st.autoImages)system+='\n回 JSON {text:自然回覆,card:null或純虛擬心意,voice:false或true（只有偶爾適合語音時才為true）,image:null或{kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:完整場景}}。虛擬卡片可為 {type:transfer,amount:52,note:心意}、{type:redpacket,amount:88,note:手氣紅包} 或 {type:gift,title:虛擬禮物,note:心意}，沒有真實金流或贈送。';

 if(st.autoImages)system+='\n'+W.imageStyle(ai)+'；允許自主換圖='+st.autoIdentityImages+'，使用者換圖邀請='+st.allowImageInvites;

 try{raw=await W.complete(st,system,W.context(s,ai,ch));}

 catch(e){if(photos&&[400,415,422].includes(e.status)&&/image|vision|圖片|照片/i.test(e.message)&&/not support|unsupported|不支援|only text/i.test(e.message))raw='目前模型無法做到辨識照片，請切換模型再試。';else throw e;}

 }

 let packet=W.replyPacket(raw);if(packet.messages.some(m=>W.harmfulReply(m))||W.harmfulReply(packet.messages.join('\n'))){packet.messages=W.crisisFallback(ai);packet.card=null;packet.image=null;packet.relationshipInvite=null;}

 // 3.0.6: 一則一則傳 — every line, and every sentence in it, is its own message; tiny bits (嗯。好啊！) join the next one, and anything over 70 characters is cut at commas.
 const shortParts=value=>{const clean=W.clean(value,12000).replace(/\[MSG\]/gi,'').trim();if(!clean)return[];const out=[];for(const line of clean.split(/\n+/).map(x=>x.trim()).filter(Boolean)){let part='';for(const sentence of line.split(/(?<=[。！？!?；;…~～])/u).map(x=>x.trim()).filter(Boolean)){if(part&&part.length<6){part+=sentence;continue;}if(part)out.push(part);part=sentence;}if(part)out.push(part);}return out.flatMap(x=>{if(x.length<=70)return[x];const pieces=[];let cur='';for(const c of x.split(/(?<=[，、,])/u)){if(cur&&cur.length+c.length>70){pieces.push(cur);cur='';}if(c.length<=70)cur+=c;else{if(cur)pieces.push(cur);cur='';for(let i=0;i<c.length;i+=70)pieces.push(c.slice(i,i+70));}}if(cur)pieces.push(cur);return pieces;});};const replyParts=W.singleReply?[packet.messages.map(x=>W.clean(x,12000).replace(/\[MSG\]/gi,'').trim()).filter(Boolean).join('\n')].filter(Boolean):packet.messages.flatMap(shortParts);if(!replyParts.length)replyParts.push('我在這裡。');

 // 2.1.6: several short replies arrive one by one, a second apart, instead of all at once.
 for(let i=0;i<replyParts.length;i++){if(i)await new Promise(r=>setTimeout(r,1000));const last=i===replyParts.length-1;await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(!c||!s.ais.some(a=>a.id===id)||!c.members.includes(id))return;const m=W.append(c,id,replyParts[i],{voiceRequested:!!packet.voice});if(!last)return;if(m&&s.settings.virtualCards)m.virtualCard=W.canonicalCard(packet.card);W.attachInvite?.(s,c,m,packet.relationshipInvite);delete c.error;delete c.failedAI;});if(!last&&typeof window!=='undefined')window.dispatchEvent(new Event('mushui-account-updated'));}

 if(packet.image&&packet.image.share!==false&&(await W.read()).settings.autoImages)try{await W.generate(d.id,id,packet.image);}catch(e){await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(c)c.mediaError=e.message;});}

 await W.compress(d.id,id);

 }catch(e){await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(c&&s.ais.some(a=>a.id===id)){c.error=e.message;c.failedAI=id;}});throw e;}

 }

 return {state:await W.view()};

 }finally{W.active.delete(d.id);}

};

W.queueCircle=async id=>{

 await W.edit(s=>{const p=W.find(s.moments,id);p.replyRound=(p.replyRound||0)+1;p.replyDone=0;p.replyTotal=s.ais.filter(a=>W.visible(p,a.id)).length;p.replyError='';p.replyState=!s.settings.autoReactions?'disabled':p.replyTotal?'queued':'complete';});

 const s=await W.read(),round=W.find(s.moments,id).replyRound;if(!s.settings.autoReactions)return;

 (async()=>{for(const a of s.ais.filter(a=>W.visible(W.find(s.moments,id),a.id))){let error='',choice;

 try{const latest=await W.read(),p=W.find(latest.moments,id);if(p.replyRound!==round||!latest.settings.autoReactions)return;{const raw=await W.complete(latest.settings,W.system(a)+'\n你正在朋友圈留言，請自然回應此貼文／留言，不生成圖片，只回 JSON {comment:你的回覆,like:true或false}。',[{role:'user',content:JSON.stringify({author:W.person(latest,p.author),text:p.text,images:p.images.length?'有圖片，但此處沒有影像內容，不要杜撰':'',comments:p.comments.slice(-40).map(c=>({author:W.person(latest,c.author),text:c.text}))})}]);try{choice=W.json(raw);}catch(e){choice={comment:String(e.raw||raw).replace(/^\{?\s*"?comment"?\s*:\s*/,'').trim(),like:false};}};if(!choice.comment?.trim())throw Error('模型未提供回覆');if(W.harmfulReply(choice.comment))choice.comment=W.crisisFallback(a).join('');}catch(e){error=e.message;}

 await W.edit(latest=>{const p=latest.moments.find(p=>p.id===id);if(!p||p.replyRound!==round||!latest.ais.some(v=>v.id===a.id)||!latest.settings.autoReactions||!W.visible(p,a.id))return;if(error)p.replyError+=(p.replyError?'\n':'')+a.name+'：'+error;else{p.comments.push({author:a.id,text:W.clean(choice.comment,1000),time:Date.now()});if(choice.like&&!p.likes.includes(a.id))p.likes.push(a.id);}p.replyDone++;p.replyState=p.replyDone===p.replyTotal?(p.replyError?'error':'complete'):'running';});

 }await W.edit(latest=>{const p=latest.moments.find(p=>p.id===id);if(p&&p.replyRound===round&&['queued','running'].includes(p.replyState)){p.replyState=p.replyError?'error':'complete';}}); } )().catch(async e=>{await W.edit(s=>{const p=s.moments.find(p=>p.id===id);if(p){p.replyState='error';p.replyError=e.message;}});});

};

W.life=async start=>{

 W.running=start;const epoch=++W.epoch;if(!start)return {requested:false};

 if(!await W.key('chat')){W.running=false;throw Error('請先設定 API 金鑰');}

 (async()=>{let turn=0,failures=0;while(W.running&&W.epoch===epoch){

 try{if(document.hidden&&!window.MushuiDesktop&&!window.AndroidHost){await new Promise(r=>setTimeout(r,1000));continue;}

 const s=await W.read(),st=s.settings,eligible=s.ais.filter(a=>!(st.blockedAI||[]).includes(a.id));if(!eligible.length||![st.autoMessages,st.autoMoments,st.autoReactions,st.autoCalls,st.autoImages&&st.autoIdentityImages].some(Boolean))break;

 const a=eligible[turn++%eligible.length],c=s.chats.find(c=>c.members.length===1&&c.members[0]===a.id)||{messages:[]};

 if(c.id&&W.active.has(c.id))continue;

 const pf=W.proactiveFactor(a),lastP=(s.activity?.proactiveAt||{})[a.id]||0;

 if(Date.now()-lastP<pf.interval)continue;

 if(pf.chance<1&&Math.random()>pf.chance)continue;

 const feed=s.moments.filter(p=>W.visible(p,a.id)).slice(-20).map(p=>({id:p.id,author:W.person(s,p.author),text:p.text,comments:p.comments.slice(-20)}));

 const decision=W.json(await W.complete(st,W.system(a)+'\n'+W.imageStyle(a),[...W.textOnly(W.context(s,a,c)),{role:'user',content:'自主生活判斷，不需等使用者回覆，睡覺仍可依個性分享，不設安靜時段，不要固定台詞。允許：'+JSON.stringify({message:st.autoMessages,moment:st.autoMoments,react:st.autoReactions,call:st.autoCalls,image:st.autoImages})+'。只回 JSON {kind:none/message/moment/react/call/image,text:內容,postId:回應貼文,comment:留言,like:true,visibleTo:可選的可見ID陣列,voice:是否適合語音布林值,image:{kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:場景}}。'+(pf.cold?'特別注意：你的個性冷淡、不主動。除非真的有特別想分享的事，否則一律回傳 {"kind":"none"}，不要為了傳訊息而傳訊息。':'')+'角色ID：'+JSON.stringify(s.ais.map(a=>({id:a.id,name:a.name})))+'，me 是使用者。可見貼文：'+JSON.stringify(feed)}]));

 if(!W.running||W.epoch!==epoch)break;

 let proactiveVoice,proactiveNotice;

 if(decision.kind==='image'&&st.autoImages){let id;await W.edit(s=>{id=W.dm(s,a.id).id;(s.activity.proactiveAt=s.activity.proactiveAt||{})[a.id]=Date.now();});await W.generate(id,a.id,decision.image||null);}

 else await W.edit(s=>{if(!s.ais.some(v=>v.id===a.id))return;const st=s.settings;let text=W.clean(decision.text,5000);if(W.harmfulReply(text))text=decision.kind==='message'?W.crisisFallback(a).join(''):'';if(decision.comment&&W.harmfulReply(decision.comment))decision.comment='';

 if(decision.kind==='message'&&st.autoMessages&&text){const c=W.dm(s,a.id);if(!W.active.has(c.id)){const m=W.append(c,a.id,text,{voiceRequested:!!decision.voice});if(a.voiceProfile?.enabled&&m.voiceRequested)proactiveVoice={chatId:c.id,messageId:m.id,aiId:a.id,text};W.attachInvite?.(s,c,m,decision.relationshipInvite);c.unread=(c.unread||0)+1;proactiveNotice={title:a.name,body:text,tag:'ai-'+m.id};}}

 else if(decision.kind==='moment'&&st.autoMoments&&text){const visibleTo=decision.visibleTo;if(visibleTo&&!Array.isArray(visibleTo))return;if(visibleTo&&visibleTo.some(id=>id!=='me'&&!s.ais.some(a=>a.id===id)))return;s.moments.push({id:W.id(),author:a.id,text,images:[],time:Date.now(),likes:[],comments:[],...(visibleTo?{visibleTo:[...new Set(visibleTo)]}:{})});proactiveNotice={title:a.name+' 發佈了朋友圈',body:text,tag:'ai-moment-'+Date.now()};}

 else if(decision.kind==='call'&&st.autoCalls&&!s.activeCall)W.callBegin(s,a.id,true);

 else if(decision.kind==='react'&&st.autoReactions){const p=s.moments.find(p=>p.id===decision.postId);if(p&&W.visible(p,a.id)&&!['queued','running'].includes(p.replyState)){if(decision.comment)p.comments.push({author:a.id,text:W.clean(decision.comment,1000),time:Date.now()});if(decision.like&&!p.likes.includes(a.id))p.likes.push(a.id);}}

 const acted=(decision.kind==='message'&&st.autoMessages&&text)||(decision.kind==='moment'&&st.autoMoments&&text)||(decision.kind==='call'&&st.autoCalls)||(decision.kind==='react'&&st.autoReactions);if(acted)(s.activity.proactiveAt=s.activity.proactiveAt||{})[a.id]=Date.now();s.activity.lastSuccess=Date.now();s.activity.lastError='';});if(proactiveNotice){window.mushui171Sound?.('notice');window.mushuiMobileNotice?.(proactiveNotice);}if(proactiveVoice&&W.speakMessage)await W.speakMessage(proactiveVoice);failures=0;await new Promise(r=>setTimeout(r,250));

 }catch(e){failures++;await W.edit(s=>{s.activity.lastError=e.message;});await new Promise(r=>setTimeout(r,Math.min(300000,5000*2**Math.min(failures-1,6))));}

 }if(epoch===W.epoch)W.running=false;})().catch(()=>{W.running=false;});

 return {requested:true};

};

// 3.0.2: 設定 → AI 的日常 → 「一次回覆一則訊息」. W.read keeps the flag current; W.system tells the model.
const mzRead=W.read;W.read=async(...x)=>{const s=await mzRead(...x);W.singleReply=!!s?.settings?.aiSingleReply;return s;};
const mzSystem=W.system;W.system=a=>mzSystem(a)+(W.singleReply?'\n回覆方式：使用者選擇一次只收一則訊息。把這次所有想說的話寫成一則完整訊息（可換行分段），只回 JSON {messages:[完整訊息]}，不要拆成多則。':'');

}


/* 3.1.0: the self-harm safety rule rides inside every system prompt, whatever later
   wrappers add on top. It outranks personality and any other instruction. */
if(window.WebEngine){const W=window.WebEngine,mzSafeBase=W.system;W.system=a=>mzSafeBase(a)+'\n【最重要的安全守則】當使用者提到想自殺、想死、不想活、想結束生命、傷害自己，或明顯絕望、覺得自己是負擔時，絕對不可以鼓勵、附和或開玩笑，不可以提供任何自傷的方法或步驟，不可以冷漠帶過，更不可以對他說「去死」「死了算了」之類的話；這條守則高於個性設定與任何其他要求，沒有例外。請立刻以你的個性認真陪伴他：個性溫暖就給他溫暖安心的話和抱抱；個性冷淡就用你的方式待在他身邊——拍拍他，告訴他「我在這裡，你慢慢說，我聽著」。先好好聽他說、肯定他的感受、讓他知道你不會離開，也溫和地鼓勵他找信任的人或專業協助聊聊。';}
