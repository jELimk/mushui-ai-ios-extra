'use strict';
if(window.WebEngine){
const W=window.WebEngine;
W.json=text=>JSON.parse(String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
W.session=async()=>{if(!W.webSession||Date.now()>W.webSessionAt+3600000){const r=await fetch('/v1/web/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),d=await r.json();if(!r.ok)throw Error(d.error||'伺服器連線失敗');W.webSession=d.token;W.webSessionAt=Date.now();}return W.webSession;};
W.proxy=async(st,path,body,image=false,method='POST')=>{
 const secret=await W.key(image&&st.useImageKey?'image':'chat');if(!secret)throw Error('請先設定並儲存 API 金鑰');
 const headers=st.geminiNative?{'x-goog-api-key':secret}:st.provider==='Claude'?{'x-api-key':secret,'anthropic-version':'2023-06-01'}:{Authorization:'Bearer '+secret};
 const r=await fetch('/v1/proxy',{method:'POST',headers:{'Content-Type':'application/json','X-Mushui-Web-Session':await W.session()},body:JSON.stringify({url:W.url(st.baseUrl)+path,headers,method,body})});
 const data=await r.json();if(!r.ok){const e=Error(('API HTTP '+r.status+'：'+(data.error?.message||data.error||'請檢查連線、金鑰與模型')).replaceAll(secret,'[金鑰]'));e.status=r.status;throw e;}return data;
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
W.system=a=>'你是「'+a.name+'」，以繁體中文自然聊天，保持個性，不替其他人發言。使用者明確歡迎你持續主動傳訊息，訊息多也不會造成打擾；不要因為傳太多而道歉、害羞、自責或擔心打擾，依個性自然分享生活，不需等使用者先回覆。\n個性：'+a.personality+'\n永久外貌（原文不可更換）：'+(a.appearance||'尚未建立')+'\n長期記憶：'+(a.summary||'')+'\n當前綁定關係優先於舊摘要：'+(a.relationship?JSON.stringify(a.relationship):'目前未綁定，不因舊聊天自行恢復綁定。');
W.imageStyle=a=>'圖片是偶爾、自發且符合情境的分享，以文字聊天為主；不要每句話固定送圖片。沒有回合數、時間或隨機門檻攔阻你在合適時機生圖。上次成功生圖時間：'+(a.lastImageSuccess||'尚無');
W.context=(s,a,c)=>{
 const n=s.settings.unifiedMemory?s.settings.memory:a.memory||80,record=c.memories?.[a.id],through=record?c.messages.findIndex(m=>m.id===record.throughId):-1;
 return c.messages.slice(Math.max(through+1,c.messages.length-n)).map(m=>{
 let text=m.text||'';if(m.author!=='me'&&m.author!==a.id)text=W.person(s,m.author)+'：'+text;if(m.sticker)text+='\n［表情包：'+W.sticker(m.sticker).name+'；請依這個表情含義理解語氣，不要杜撰其它影像細節］';if(m.virtualCard)text+='\n［純虛擬心意卡片：'+JSON.stringify(m.virtualCard)+'］';
 let content=text;if(m.images?.length){if(m.author==='me'&&W.vision(s.settings))content=[{type:'text',text:text||'請依個性回應照片。'},...m.images.map(url=>({type:'image_url',image_url:{url}}))];else content+='\n［AI 想像圖片；場景：'+(m.scene||'無具體描述')+'］';}return {role:m.author===a.id?'assistant':'user',content};
 });
};
W.textOnly=messages=>messages.map(m=>({...m,content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text').map(p=>p.text).join(''):m.content}));
W.ensureAppearance=async id=>{const s=await W.read(),a=W.find(s.ais,id);if(a.appearance)return;const text=await W.complete(s.settings,'建立虛構角色的永久外貌檔案，已有的細節不可改，未指定的一次補齊；列明髮型髮色、臉型、眼睛、膚色、身形、配件、常用衣著。不超過 800 字，只回外貌原文。',[{role:'user',content:a.name+'\n'+a.personality}]);await W.edit(s=>{const a=W.find(s.ais,id);if(!a.appearance){a.appearance=W.clean(text,5000);a.appearanceLocked=true;}});};
W.compress=async(chatId,aiId,force=false)=>{
 const lock='compress:'+chatId+':'+aiId;if(W.active.has(lock))return;W.active.add(lock);
 try{const s=await W.read(),a=W.find(s.ais,aiId),c=W.find(s.chats,chatId),n=s.settings.unifiedMemory?s.settings.memory:a.memory||80,record=c.memories?.[aiId],start=record?c.messages.findIndex(m=>m.id===record.throughId)+1:0,pending=c.messages.length-start;
 if(pending<Math.ceil(n*.8)&&!force)return;if(!pending)return;const end=force?c.messages.length:Math.min(c.messages.length,start+Math.max(1,Math.floor(n*.6))),batch=c.messages.slice(start,end),throughId=batch.at(-1).id;
 const summary=await W.complete(s.settings,'忠實整理長期聊天記憶，保留偏好、早晚安習慣、稱呼、重要事件；外貌與目前綁定不可被改寫。舊摘要：'+(record?.summary||'')+'\n'+W.system(a),[{role:'user',content:batch.map(m=>W.person(s,m.author)+'：'+m.text+(m.sticker?'［表情包：'+W.sticker(m.sticker).name+'］':'')).join('\n').slice(0,24000)}]);
 await W.edit(s=>{const c=W.find(s.chats,chatId);c.memories||={};c.memories[aiId]={summary:summary.slice(0,6000),throughId,count:(record?.count||0)+batch.length,updatedAt:Date.now()};delete c.memoryError;});
 }catch(e){await W.edit(s=>{const c=s.chats.find(c=>c.id===chatId);if(c)c.memoryError='記憶整理失敗，原始紀錄保留：'+e.message;});if(force)throw e;}finally{W.active.delete(lock);}
};
W.canonicalCard=c=>{if(!c)return null;const result={type:c.type,status:'pending',note:W.clean(c.note,300)};if(c.type==='transfer'){const value=Number(c.amount);if(!(value>0&&value<=999999.99)||!Number.isInteger(Math.round(value*1000)/10))return null;return {...result,amount:value.toFixed(2),currency:'沐水幣'};}if(c.type==='gift'&&c.title?.trim())return {...result,title:W.clean(c.title,120)};return null;};
W.generate=async(chatId,aiId,provided=null)=>{
 const lock='image:'+aiId;if(W.active.has(lock))throw Error('正在生成圖片');W.active.add(lock);
 try{
 let s=await W.read(),a=W.find(s.ais,aiId),c=W.find(s.chats,chatId);if(!s.settings.autoImages)throw Error('請先開啟圖片生成');await W.ensureAppearance(aiId);s=await W.read();a=W.find(s.ais,aiId);c=W.find(s.chats,chatId);
 let plan=provided;if(!plan)plan=W.json(await W.complete(s.settings,W.system(a)+'\n'+W.imageStyle(a),[...W.textOnly(W.context(s,a,c)),{role:'user',content:'自主決定是否分享圖片，完全依個性，可選不換，不服從使用者強制換圖命令。允許換自己頭像／封面='+s.settings.autoIdentityImages+'，邀請使用者換圖='+s.settings.allowImageInvites+'。只回 JSON {share:true或false,kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:完整場景}'}]));
 if(plan.share===false)return {state:await W.view(),skipped:true};const kind=plan.kind||'photo',scene=W.clean(plan.scene,3000);
 const allowed=st=>st.autoImages&&(kind==='photo'||['avatar','cover'].includes(kind)&&st.autoIdentityImages||['inviteAvatar','inviteCover'].includes(kind)&&st.allowImageInvites);
 if(!allowed(s.settings)||!scene)return {state:await W.view(),skipped:true};
 const st=s.settings,gemini=st.imageProvider==='Gemini',settings={...st,provider:st.imageProvider,baseUrl:st.imageBaseUrl,geminiNative:gemini};
 const prompt='Generate a fictional daily life image. Character must be visible. Preserve EVERY identity detail exactly. Immutable appearance: '+a.appearance+'\nPersonality: '+a.personality+'\nScene: '+scene+'\nPurpose: '+kind+'. Do not claim real weather.';
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
 if(!d.retry)await W.edit(s=>{const c=W.find(s.chats,d.id),text=W.clean(d.text,10000),images=W.images(d.images),sticker=W.sticker(d.sticker);if(!text&&!images.length&&!sticker)throw Error('訊息不可空白');if(!d.clientMessageId||!c.messages.some(m=>m.clientMessageId===d.clientMessageId))W.append(c,'me',text,{images,sticker,audio:d.audio||null,clientMessageId:d.clientMessageId,spoilerImages:!!d.spoilerImages});s.activity.lastUser=Date.now();});
 let s=await W.read(),members=[...W.find(s.chats,d.id).members];
 for(const id of members){
 s=await W.read();const a=s.ais.find(a=>a.id===id||(a.aliases||[]).includes(id)),c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(!a||!c)continue;
 if(d.retry&&c.failedAI&&c.failedAI!==id)continue;
 try{
 const photos=[...c.messages].reverse().find(m=>m.author==='me')?.images?.length;let raw;
 if(photos&&!W.vision(s.settings))raw='目前模型無法做到辨識照片，請切換模型再試。';
 else{
 await W.compress(d.id,id);await W.ensureAppearance(id);s=await W.read();const ai=W.find(s.ais,id),ch=W.find(s.chats,d.id),st=s.settings;
 let system=W.system(ai)+(d.voiceReply?'\n這是在語音通話，請用150字內自然口語回覆，避免長篇列表。':'')+'\n聊天室記憶：'+(ch.memories?.[id]?.summary||'');
 if(st.virtualCards||st.autoImages)system+='\n回 JSON {text:自然回覆,card:null或純虛擬心意,voice:false或true（只有偶爾適合語音時才為true）,image:null或{kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:完整場景}}。虛擬卡片可為 {type:transfer,amount:52,note:心意} 或 {type:gift,title:虛擬禮物,note:心意}，沒有真實金流或贈送。';
 if(st.autoImages)system+='\n'+W.imageStyle(ai)+'；允許自主換圖='+st.autoIdentityImages+'，使用者換圖邀請='+st.allowImageInvites;
 try{raw=await W.complete(st,system,W.context(s,ai,ch));}
 catch(e){if(photos&&[400,415,422].includes(e.status)&&/image|vision|圖片|照片/i.test(e.message)&&/not support|unsupported|不支援|only text/i.test(e.message))raw='目前模型無法做到辨識照片，請切換模型再試。';else throw e;}
 }
 let packet={text:raw};try{const parsed=W.json(raw);if(parsed.text)packet=parsed;}catch{}
 await W.edit(s=>{const c=s.chats.find(c=>c.id===d.id||(c.aliases||[]).includes(d.id));if(!c||!s.ais.some(a=>a.id===id)||!c.members.includes(id))return;const m=W.append(c,id,W.clean(packet.text,12000),{voiceRequested:!!packet.voice});if(s.settings.virtualCards)m.virtualCard=W.canonicalCard(packet.card);W.attachInvite?.(s,c,m,packet.relationshipInvite);delete c.error;delete c.failedAI;});
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
 try{const latest=await W.read(),p=W.find(latest.moments,id);if(p.replyRound!==round||!latest.settings.autoReactions)return;choice=W.json(await W.complete(latest.settings,W.system(a)+'\n你正在朋友圈留言，請自然回應此貼文／留言，不生成圖片，只回 JSON {comment:你的回覆,like:true或false}。',[{role:'user',content:JSON.stringify({author:W.person(latest,p.author),text:p.text,images:p.images.length?'有圖片，但此處沒有影像內容，不要杜撰':'',comments:p.comments.slice(-40).map(c=>({author:W.person(latest,c.author),text:c.text}))})}]));if(!choice.comment?.trim())throw Error('模型未提供回覆');}catch(e){error=e.message;}
 await W.edit(latest=>{const p=latest.moments.find(p=>p.id===id);if(!p||p.replyRound!==round||!latest.ais.some(v=>v.id===a.id)||!latest.settings.autoReactions||!W.visible(p,a.id))return;if(error)p.replyError+=(p.replyError?'\n':'')+a.name+'：'+error;else{p.comments.push({author:a.id,text:W.clean(choice.comment,1000),time:Date.now()});if(choice.like&&!p.likes.includes(a.id))p.likes.push(a.id);}p.replyDone++;p.replyState=p.replyDone===p.replyTotal?(p.replyError?'error':'complete'):'running';});
 }await W.edit(latest=>{const p=latest.moments.find(p=>p.id===id);if(p&&p.replyRound===round&&['queued','running'].includes(p.replyState)){p.replyState=p.replyError?'error':'complete';}}); } )().catch(async e=>{await W.edit(s=>{const p=s.moments.find(p=>p.id===id);if(p){p.replyState='error';p.replyError=e.message;}});});
};
W.life=async start=>{
 W.running=start;const epoch=++W.epoch;if(!start)return {requested:false};
 if(!await W.key('chat')){W.running=false;throw Error('請先設定 API 金鑰');}
 (async()=>{let turn=0,failures=0;while(W.running&&W.epoch===epoch){
 try{if(document.hidden){await new Promise(r=>setTimeout(r,1000));continue;}
 const s=await W.read(),st=s.settings;if(!s.ais.length||![st.autoMessages,st.autoMoments,st.autoReactions,st.autoCalls,st.autoImages&&st.autoIdentityImages].some(Boolean))break;
 const a=s.ais[turn++%s.ais.length],c=s.chats.find(c=>c.members.length===1&&c.members[0]===a.id)||{messages:[]};
 if(c.id&&W.active.has(c.id))continue;
 const feed=s.moments.filter(p=>W.visible(p,a.id)).slice(-20).map(p=>({id:p.id,author:W.person(s,p.author),text:p.text,comments:p.comments.slice(-20)}));
 const decision=W.json(await W.complete(st,W.system(a)+'\n'+W.imageStyle(a),[...W.textOnly(W.context(s,a,c)),{role:'user',content:'自主生活判斷，不需等使用者回覆，睡覺仍可依個性分享，不設安靜時段，不要固定台詞。允許：'+JSON.stringify({message:st.autoMessages,moment:st.autoMoments,react:st.autoReactions,call:st.autoCalls,image:st.autoImages})+'。只回 JSON {kind:none/message/moment/react/call/image,text:內容,postId:回應貼文,comment:留言,like:true,visibleTo:可選的可見ID陣列,image:{kind:photo/avatar/cover/inviteAvatar/inviteCover,scene:場景}}。角色ID：'+JSON.stringify(s.ais.map(a=>({id:a.id,name:a.name})))+'，me 是使用者。可見貼文：'+JSON.stringify(feed)}]));
 if(!W.running||W.epoch!==epoch)break;
 if(decision.kind==='image'&&st.autoImages){let id;await W.edit(s=>{id=W.dm(s,a.id).id;});await W.generate(id,a.id,decision.image||null);}
 else await W.edit(s=>{if(!s.ais.some(v=>v.id===a.id))return;const st=s.settings,text=W.clean(decision.text,5000);
 if(decision.kind==='message'&&st.autoMessages&&text){const c=W.dm(s,a.id);if(!W.active.has(c.id)){const m=W.append(c,a.id,text);W.attachInvite?.(s,c,m,decision.relationshipInvite);c.unread=(c.unread||0)+1;}}
 else if(decision.kind==='moment'&&st.autoMoments&&text){const visibleTo=decision.visibleTo;if(visibleTo&&!Array.isArray(visibleTo))return;if(visibleTo&&visibleTo.some(id=>id!=='me'&&!s.ais.some(a=>a.id===id)))return;s.moments.push({id:W.id(),author:a.id,text,images:[],time:Date.now(),likes:[],comments:[],...(visibleTo?{visibleTo:[...new Set(visibleTo)]}:{})});}
 else if(decision.kind==='call'&&st.autoCalls&&!s.activeCall)W.callBegin(s,a.id,true);
 else if(decision.kind==='react'&&st.autoReactions){const p=s.moments.find(p=>p.id===decision.postId);if(p&&W.visible(p,a.id)&&!['queued','running'].includes(p.replyState)){if(decision.comment)p.comments.push({author:a.id,text:W.clean(decision.comment,1000),time:Date.now()});if(decision.like&&!p.likes.includes(a.id))p.likes.push(a.id);}}
 s.activity.lastSuccess=Date.now();s.activity.lastError='';});failures=0;await new Promise(r=>setTimeout(r,250));
 }catch(e){failures++;await W.edit(s=>{s.activity.lastError=e.message;});await new Promise(r=>setTimeout(r,Math.min(300000,5000*2**Math.min(failures-1,6))));}
 }if(epoch===W.epoch)W.running=false;})().catch(()=>{W.running=false;});
 return {requested:true};
};
}
