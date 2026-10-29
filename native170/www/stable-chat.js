'use strict';
window.installStableChat=()=>{
 if(window.StableChatInstalled)return;window.StableChatInstalled=true;
 const limit=new Map();let session=null;
 function anchor(node){const top=node.getBoundingClientRect().top;const m=[...node.querySelectorAll('[data-message-id]')].find(m=>m.getBoundingClientRect().bottom>top+1);return m?{id:m.dataset.messageId,offset:m.getBoundingClientRect().top-top}:null;}
 function place(s){if(session!==s||!s.node.isConnected)return;const n=s.node;if(s.follow)n.scrollTop=n.scrollHeight;else{const m=s.anchor&&n.querySelector('[data-message-id="'+CSS.escape(s.anchor.id)+'"]');n.scrollTop=m?n.scrollTop+m.getBoundingClientRect().top-n.getBoundingClientRect().top-s.anchor.offset:s.top;}}
 document.addEventListener('compositionend',()=>{if(window.chatRenderPending){window.chatRenderPending=false;requestAnimationFrame(()=>render());}});
 const before=render;render=function(){
  if(composingText){window.chatRenderPending=true;return;}
  const old=document.querySelector('.message-scroll'),same=old&&old.dataset.chatId===chatId;
  const saved=same?{follow:old.scrollHeight-old.clientHeight-old.scrollTop<32,anchor:anchor(old),top:old.scrollTop}:null;
  const input=document.querySelector('.composer textarea'),focus=input===document.activeElement,start=input?.selectionStart,end=input?.selectionEnd;
  session?.observer.disconnect();session=null;
  const ch=state?.chats.find(c=>c.id===chatId),messages=ch?.messages,total=messages?.length||0,count=limit.get(chatId)||80;
  if(messages&&total>count)ch.messages=messages.slice(-count);
  try{before();}finally{if(messages)ch.messages=messages;}
  const n=document.querySelector('.message-scroll');if(!n)return;n.dataset.chatId=chatId;
  if(total>count)n.insertAdjacentHTML('afterbegin','<button class="pill full load-history" data-action="loadEarlier">載入較早訊息（還有 '+(total-count)+' 則）</button>');
  const s={node:n,follow:saved?.follow??true,anchor:saved?.anchor||null,top:saved?.top||0,observer:null};session=s;
  place(s);
  if(focus){const field=document.querySelector('.composer textarea');field?.focus({preventScroll:true});field?.setSelectionRange(start,end);place(s);}
  // Ignore programmatic/layout scroll events. Only user scrolling changes intent.
  let userUntil=0;const intent=()=>{userUntil=performance.now()+900;};
  for(const e of ['wheel','touchstart','touchmove','pointerdown','keydown'])n.addEventListener(e,intent,{passive:true});
  n.addEventListener('scroll',()=>{if(performance.now()>userUntil)return;s.follow=n.scrollHeight-n.clientHeight-n.scrollTop<32;s.top=n.scrollTop;s.anchor=anchor(n);},{passive:true});
  s.observer=new ResizeObserver(()=>place(s));s.observer.observe(n);for(const item of n.children)s.observer.observe(item);
  for(const img of n.querySelectorAll('img'))img.addEventListener('load',()=>place(s),{once:true});requestAnimationFrame(()=>place(s));
 };
 window.revealChatMessage=id=>{const ch=state.chats.find(c=>c.id===chatId),index=ch?.messages.findIndex(m=>String(m.id)===String(id));if(ch&&index>=0)limit.set(chatId,Math.max(80,ch.messages.length-index+5));render();requestAnimationFrame(()=>{const n=document.querySelector('.message-scroll'),row=n?.querySelector('[data-message-id="'+CSS.escape(isHumanChat()?'human-'+id:id)+'"]');if(row){row.scrollIntoView({block:'center',behavior:'instant'});if(session){session.follow=false;session.top=n.scrollTop;session.anchor=anchor(n);}row.classList.add('message-highlight');setTimeout(()=>row.classList.remove('message-highlight'),1400);}});};
 actions.loadEarlier=()=>{limit.set(chatId,(limit.get(chatId)||80)+80);render();};
 if(state)render();
};
if(window.DesktopUIReady)window.installStableChat();
