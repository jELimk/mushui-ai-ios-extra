'use strict';
/* Message reactions with the app's own stickers (never emoji).
   Long-press / right-click a message → 訊息操作 → 加表情, pick any
   built-in or custom sticker, and it stays on that message as a small
   badge. Reactions live in a local overlay keyed by chat + message id,
   so the same code path serves AI chats and human chats. */
const mzReactionOverlay={
 read(){try{return JSON.parse(localStorage.getItem('mzReactions')||'{}');}catch{return{};}},
 write(v){try{localStorage.setItem('mzReactions',JSON.stringify(v));}catch{}}
};
function mzReactionRef(chat,id){
 const all=mzReactionOverlay.read();
 return all?.[chat]?.[String(id)]||null;
}
function mzReactionSet(chat,id,ref){
 const all=mzReactionOverlay.read();
 if(!all[chat])all[chat]={};
 if(ref)all[chat][String(id)]=ref;else delete all[chat][String(id)];
 if(!Object.keys(all[chat]).length)delete all[chat];
 mzReactionOverlay.write(all);
}
function mzReactionVisual(ref){
 if(!ref)return null;
 if(ref.kind==='custom'){
  const s=(state.settings.customStickers||[]).find(x=>String(x.id)===String(ref.id));
  return s?{img:s.data,name:s.name||'自訂表情'}:null;
 }
 const s=typeof stickerById==='function'?stickerById(ref.id):null;
 return s?{img:s.asset,name:s.name}:null;
}
function mzReactionPicker(mid){
 const current=mzReactionRef(chatId,mid);
 const custom=state.settings.customStickers||[];
 const cell=(ref,img,name)=>`<button class="mz-react-cell${current&&current.kind===ref.kind&&String(current.id)===String(ref.id)?' selected':''}" data-mz-react="${esc(ref.kind)}:${esc(String(ref.id))}" aria-label="${esc(name)}"><img src="${esc(img)}" alt="${esc(name)}" loading="lazy"></button>`;
 showModal('為訊息加表情',`
  ${current?'<button class="pill" data-mz-react-remove="1">移除目前的表情</button>':''}
  <div class="mz-react-grid">${stickerCatalog.map(s=>cell({kind:'catalog',id:s.id},s.asset,s.name)).join('')}</div>
  ${custom.length?`<h3 class="custom-sticker-heading">我的表情包</h3><div class="mz-react-grid">${custom.map(s=>cell({kind:'custom',id:s.id},s.data,s.name||'自訂表情')).join('')}</div>`:''}
  <p class="help">點一張表情就會貼到這則訊息上；再點一次其他表情可以更換。</p>`);
}
const mzMessageActionsBase=messageActions;
messageActions=function(id){
 mzMessageActionsBase(id);
 const sheet=document.querySelector('.sheet-actions');
 if(!sheet||sheet.querySelector('[data-action="reactMessage"]'))return;
 sheet.insertAdjacentHTML('beforeend',`<button class="pill" data-action="reactMessage">${icon('smile')} 加表情</button>`);
};
actions.reactMessage=()=>{mzReactionPicker(messageMenuId);};
const mzRenderBeforeReactions=render;
render=function(){
 mzRenderBeforeReactions();
 if(!chatId)return;
 const all=mzReactionOverlay.read();
 const map=all?.[chatId];
 if(!map)return;
 const list=document.querySelector('.message-list');
 if(!list)return;
 for(const row of list.querySelectorAll('[data-message-id]')){
  const mid=String(row.dataset.messageId).replace(/^human-/,'');
  const ref=map[mid];
  if(!ref||row.querySelector('.mz-reaction'))continue;
  const visual=mzReactionVisual(ref);
  const body=row.querySelector('.message-body');
  if(!visual||!body)continue;
  const holder=document.createElement('div');
  holder.className='mz-reaction';
  holder.innerHTML=`<button class="mz-reaction-badge" data-mz-react-badge="${esc(mid)}" aria-label="更改這則訊息的表情"><img src="${esc(visual.img)}" alt="${esc(visual.name)}"></button>`;
  body.appendChild(holder);
 }
};
document.addEventListener('click',e=>{
 const cell=e.target.closest('[data-mz-react]');
 if(cell){
  const raw=String(cell.dataset.mzReact);
  const sep=raw.indexOf(':');
  mzReactionSet(chatId,messageMenuId,{kind:raw.slice(0,sep),id:raw.slice(sep+1)});
  closeModal();
  render();
  return;
 }
 if(e.target.closest('[data-mz-react-remove]')){
  mzReactionSet(chatId,messageMenuId,null);
  closeModal();
  render();
  return;
 }
 const badge=e.target.closest('[data-mz-react-badge]');
 if(badge){
  messageMenuId=badge.dataset.mzReactBadge;
  mzReactionPicker(messageMenuId);
 }
});
const mzReactionStyle=document.createElement('style');
mzReactionStyle.textContent=`.mz-react-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.mz-react-cell{border:2px solid transparent;border-radius:14px;background:var(--card-soft,rgba(127,90,240,.06));padding:6px;cursor:pointer}.mz-react-cell.selected{border-color:var(--accent,#7f5af0)}.mz-react-cell img{width:100%;aspect-ratio:1;object-fit:contain;display:block}.mz-reaction{display:flex;margin-top:3px}.message.mine .mz-reaction{justify-content:flex-end}.mz-reaction-badge{border:none;background:var(--card-soft,rgba(127,90,240,.08));border-radius:999px;padding:3px 7px;cursor:pointer;line-height:0}.mz-reaction-badge img{width:30px;height:30px;object-fit:contain}`;
document.head.appendChild(mzReactionStyle);
