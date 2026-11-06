'use strict';
/* Forwarded messages carry a small note under the bubble so the other
   side can clearly see the message was forwarded. The note borrows the
   reply quote's look: a straight purple bar on the side, the words
   已轉發 in small type, and a minimal forward icon. */
const mzRenderBeforeForwarded=render;
render=function(){
 mzRenderBeforeForwarded();
 if(!chatId)return;
 const list=document.querySelector('.message-list');
 if(!list)return;
 for(const row of list.querySelectorAll('[data-message-id]')){
  if(row.querySelector('.mz-forwarded'))continue;
  const body=row.querySelector('.message-body');
  if(!body)continue;
  const m=messageById(String(row.dataset.messageId).replace(/^human-/,''));
  if(!m||!m.forwarded)continue;
  const note=document.createElement('div');
  note.className='mz-forwarded';
  note.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v6"/></svg><span>已轉發</span>';
  body.appendChild(note);
 }
};
const mzFwdStyle=document.createElement('style');
mzFwdStyle.textContent=`.mz-forwarded{display:flex;align-items:center;gap:4px;width:fit-content;margin-top:3px;padding:1px 8px 1px 7px;border-left:3px solid var(--accent);border-radius:6px;background:var(--soft);color:var(--muted);font-size:.74rem;line-height:1.6}.mz-forwarded svg{width:12px;height:12px;flex:0 0 auto}.message.mine .mz-forwarded{margin-left:auto}`;
document.head.appendChild(mzFwdStyle);
