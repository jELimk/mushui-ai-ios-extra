'use strict';
const stickerDrafts={};
let stickerPanelChat='',stickerFilter='png';
paths.smile='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 9h.01 M16 9h.01 M8 14q4 5 8 0';
const stickerCatalog=[...Array.from({length:41},(_,i)=>({id:'png-'+(i+1),name:'表情 '+(i+1),asset:'stickers/jelee/'+(i+1)+'.png',type:'png'})),...Array.from({length:8},(_,i)=>({id:'gif-'+(i+1),name:'動態表情 '+(i+1),asset:'stickers/jelee/gif-'+(i+1)+'.gif',type:'gif'}))];
function stickerById(id){return stickerCatalog.find(s=>s.id===id);}
function stickerImage(s,extra=''){return `<img src="${esc(s.asset)}" alt="${esc(s.name)}" ${extra}>`;}
const renderBeforeStickers=render;
render=function(){
 renderBeforeStickers();if(!chatId){stickerPanelChat='';return;}
 const composer=document.querySelector('.composer');if(!composer)return;
 composer.querySelector('.photo-button')?.insertAdjacentHTML('afterend',`<button class="icon-button photo-button" type="button" data-action="stickers" aria-label="選擇表情包" aria-expanded="${stickerPanelChat===chatId}" ${sending.has(chatId)?'disabled':''}>${icon('smile')}</button>`);
 const draft=stickerById(stickerDrafts[chatId]?.id);
 if(draft)composer.insertAdjacentHTML('beforebegin',`<div class="sticker-draft">${stickerImage(draft)}<span>待傳送 · ${esc(draft.name)}</span><button class="pill" data-action="removeSticker">移除</button></div>`);
 if(stickerPanelChat===chatId)composer.insertAdjacentHTML('beforebegin',`<section class="sticker-panel" aria-label="表情包選單"><div class="between"><div class="flex"><button class="chip ${stickerFilter==='png'?'selected':''}" data-stickerfilter="png">靜態 41</button><button class="chip ${stickerFilter==='gif'?'selected':''}" data-stickerfilter="gif">動態 8</button></div><button class="link-button" data-action="stickers">收起</button></div><p class="small">選一張，再按傳送。可單獨傳送或搭配文字；AI 會收到表情名稱。</p><div class="sticker-grid">${stickerCatalog.filter(s=>s.type===stickerFilter).map(s=>`<button data-selectsticker="${s.id}" aria-label="${esc(s.name)}">${stickerImage(s,'loading="lazy"')}<span>${esc(s.name)}</span></button>`).join('')}</div></section>`);
 const ch=state.chats.find(c=>c.id===chatId);
 for(const m of ch?.messages||[]){const s=stickerById(m.sticker?.id);if(!s)continue;const bubble=document.querySelector(`[data-message-id="${CSS.escape(m.id)}"] .bubble`);if(!bubble)continue;bubble.insertAdjacentHTML('beforeend',`<button class="chat-sticker" data-previewsticker="${s.id}" aria-label="查看${esc(s.name)}">${stickerImage(s)}</button>`);if(!m.text&&!m.images?.length)bubble.classList.add('sticker-only');}
};
actions.stickers=()=>{stickerPanelChat=stickerPanelChat===chatId?'':chatId;render();};
actions.removeSticker=()=>{delete stickerDrafts[chatId];render();};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.stickerfilter){stickerFilter=b.dataset.stickerfilter;render();}if(b.dataset.selectsticker){const s=stickerById(b.dataset.selectsticker);if(s){stickerDrafts[chatId]={id:s.id};stickerPanelChat='';render();}}if(b.dataset.previewsticker){const s=stickerById(b.dataset.previewsticker);if(s)showModal(s.name,`<div class="sticker-preview">${stickerImage(s)}</div>`);}});
if(state)render();
