 'use strict';

{const W=WebEngine;

const key=a=>a.independentIdentity?a.id:a.sourceFingerprint?'source:'+a.sourceFingerprint+':'+JSON.stringify(a.appearance||''):'legacy:'+JSON.stringify([String(a.name).normalize('NFKC').trim(),String(a.personality).trim(),a.appearance||'']);

W.normalizeAccount=out=>{

 const meta=out.syncMeta,aliases={...(meta.aliases||{})};function resolve(id){let n=0;while(aliases[id]&&aliases[id]!==id&&n++<20)id=aliases[id];return id;}

 const groups=new Map();for(const a of out.ais){let match;if(!a.independentIdentity)for(const [id,list]of groups)if(list.some(b=>!b.independentIdentity&&(a.sourceFingerprint&&a.sourceFingerprint===b.sourceFingerprint&&(a.appearance||'')===(b.appearance||'')||JSON.stringify([a.name,a.personality,a.appearance||''])===JSON.stringify([b.name,b.personality,b.appearance||''])))){match=id;break;}const k=match||key(a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a);}

 const ais=[];for(const items of groups.values()){items.sort((a,b)=>a.id.localeCompare(b.id));const preferred=items.find(a=>a.id===resolve(a.id))||items[0],id=resolve(preferred.id),newest=items.reduce((x,y)=>(meta.records['ais/'+y.id]||0)>(meta.records['ais/'+x.id]||0)?y:x),canonical={...newest,id,appearance:preferred.appearance||newest.appearance||''};canonical.summary=[...new Set(items.map(a=>a.summary?.trim()).filter(Boolean))].join('\n');canonical.aliases=[...new Set(items.flatMap(a=>[a.id,...(a.aliases||[])]))].filter(x=>x!==id);for(const old of canonical.aliases)aliases[old]=id;meta.records['ais/'+id]=Math.max(...items.map(a=>meta.records['ais/'+a.id]||0),meta.records['ais/'+id]||0);if(!(meta.deleted['ais/'+id]&&meta.deleted['ais/'+id]>=meta.records['ais/'+id]))ais.push(canonical);}

 out.ais=ais;const chats=[];for(const original of out.chats){const c={...original,members:original.members.map(resolve),messages:original.messages.map(m=>({...m,author:resolve(m.author)}))};c.aliases=[...(original.aliases||[])];const same=chats.find(v=>c.members.length===1&&v.members.length===1&&v.members[0]===c.members[0]);if(!same){chats.push(c);continue;}const all=[same,c].sort((a,b)=>a.id.localeCompare(b.id)),canonical=all[0],other=all[1],messages=new Map();for(const m of [...other.messages,...canonical.messages]){const prior=messages.get(m.id);if(!prior||(m.editedAt||0)>=(prior.editedAt||0))messages.set(m.id,m);}const merged={...canonical,messages:[...messages.values()].sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id))),aliases:[...new Set([...(canonical.aliases||[]),other.id,...(other.aliases||[])])],messagePins:Object.fromEntries([...new Set([...Object.keys(other.messagePins||{}),...Object.keys(canonical.messagePins||{})])].map(id=>[id,(other.messagePins?.[id]?.updatedAt||0)>(canonical.messagePins?.[id]?.updatedAt||0)?other.messagePins[id]:canonical.messagePins[id]])),memories:{...other.memories,...canonical.memories}};for(const old of merged.aliases)aliases[old]=merged.id;meta.records['chats/'+merged.id]=Math.max(meta.records['chats/'+same.id]||0,meta.records['chats/'+c.id]||0);chats[chats.indexOf(same)]=merged;}

 for(const c of chats){const memory={};for(const [id,record]of Object.entries(c.memories||{})){const k=resolve(id);if(!memory[k]||(record.updatedAt||0)>(memory[k].updatedAt||0))memory[k]=record;}c.memories=memory;}

 out.moments=(out.moments||[]).map(p=>({...p,author:resolve(p.author),likes:[...new Set((p.likes||[]).map(resolve))],comments:(p.comments||[]).map(c=>({...c,author:resolve(c.author)})),...(p.visibleTo?{visibleTo:[...new Set(p.visibleTo.map(resolve))]}:{})}));

 out.chats=chats;meta.aliases=aliases;return out;

};

const find=W.find;W.find=(arr,id)=>arr.find(v=>v.id===id||(v.aliases||[]).includes(id))||find(arr,id);

const mutate=W.mutate;W.mutate=async d=>{const before=d.action==='import'?new Set((await W.read()).ais.map(a=>a.id)):null,result=await mutate(d);if(before){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d.name+'\n'+d.text)),fingerprint=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');await W.edit(s=>{for(const a of s.ais)if(!before.has(a.id))a.sourceFingerprint=fingerprint;});result.state=await W.view();}return result;};

}

const syncPanel=actions.accountSync;actions.accountSync=()=>{syncPanel();const anchor=document.querySelector('#modalError');anchor?.insertAdjacentHTML('beforebegin','<div class="card"><h3>同步診斷</h3><p class="help">檢查兩端是否同一個伺服器、帳號與聊天室；只匯出識別碼和訊息數量，不含訊息內容、密碼或 API 金鑰。</p><button class="pill" data-action="syncDiagnostics">查看診斷</button></div>');};

actions.syncDiagnostics=async()=>{const s=await WebEngine.view(),diag={version:'2.1.4',device:window.AndroidHost?'Android':window.MushuiDesktop?'Windows':window.IOSHost?'iPhone／iPad 原生':'Safari',server:s.human.serverUrl,account:s.human.me.id||'',status:s.accountSync,roles:s.ais.map(a=>({id:a.id,name:a.name,source:a.sourceFingerprint||'',aliases:a.aliases||[]})),chats:s.chats.map(c=>({id:c.id,members:c.members,count:c.messages.length,lastMessageId:c.messages.at(-1)?.id||'',aliases:c.aliases||[]}))};window.accountDiagnostic=diag;showModal('同步診斷',`<p class="help">兩端的伺服器、帳號與聊天室 ID 應一致。若同名 AI 有不同 ID，請先保留備份；新版會對齊相同角色檔案或完全相同角色設定的單人聊天室，群組不會自動合併。</p><textarea readonly class="sync-diagnostic" rows="12">${esc(JSON.stringify(diag,null,2))}</textarea><button class="pill" data-action="exportSyncDiagnostics">匯出診斷 JSON</button><button class="pill primary" data-action="accountSyncNow">重試同步</button>`);};

actions.exportSyncDiagnostics=()=>WebEngine.download('沐水同步診斷.json',JSON.stringify(window.accountDiagnostic,null,2));

