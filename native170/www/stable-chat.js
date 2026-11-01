'use strict';

window.installStableChat=()=>{

 if(window.StableChatInstalled)return;window.StableChatInstalled=true;

 const limit=new Map(),baseline=new Map(),loading=new Set();let session=null,composingInput=null,renderAfterComposition=false,activeChatId='';

 document.addEventListener('compositionstart',event=>{if(event.target?.matches?.('.composer textarea[data-input="message"]'))composingInput=event.target;},true);

 document.addEventListener('compositionend',event=>{if(event.target!==composingInput)return;composingInput=null;if(renderAfterComposition){renderAfterComposition=false;requestAnimationFrame(()=>render());}},true);

 function anchor(node){const top=node.getBoundingClientRect().top;const m=mizukiTopMessage(node);return m?{id:m.dataset.messageId,offset:m.getBoundingClientRect().top-top}:null;}

 function place(s){if(session!==s||!s.node.isConnected)return;const n=s.node;if(s.interacting)return;if(s.follow)n.scrollTop=Math.max(0,n.scrollHeight-n.clientHeight);else{const m=s.anchor&&n.querySelector('[data-message-id="'+CSS.escape(s.anchor.id)+'"]');n.scrollTop=m?n.scrollTop+m.getBoundingClientRect().top-n.getBoundingClientRect().top-s.anchor.offset:s.top;}}

 document.addEventListener('compositionend',()=>{if(window.chatRenderPending){window.chatRenderPending=false;requestAnimationFrame(()=>render());}});

 const before=render;render=function(){

  if(composingInput?.isConnected){renderAfterComposition=true;return;}

  if(composingText){window.chatRenderPending=true;return;}

  // A render during a touch used to remove .message-scroll, lose the OS gesture,
  // and send the user back to the first message. Defer data/UI updates until idle.
  if(window.MizukiChatUserScrolling && document.querySelector('.message-scroll')?.dataset.chatId===chatId){
    window.MizukiDeferredChatRender=true;return;
  }
  if(activeChatId!==chatId){window.MizukiChatUserScrolling=false;window.MizukiDeferredChatRender=false;if(activeChatId){limit.delete(activeChatId);baseline.delete(activeChatId);}if(chatId){limit.delete(chatId);baseline.delete(chatId);}activeChatId=chatId;}

  const old=document.querySelector('.message-scroll'),same=old&&old.dataset.chatId===chatId;

  const saved=same?{follow:session?.interacting ? false : (session?.follow ?? (old.scrollHeight-old.clientHeight-old.scrollTop<32)),anchor:anchor(old),top:old.scrollTop,interacting:!!session?.interacting}:null;

  const input=document.querySelector('.composer textarea'),focus=input===document.activeElement,start=input?.selectionStart,end=input?.selectionEnd;

  session?.observer.disconnect();session?.events?.abort();session=null;

  const human=isHumanChat(),ch=human?null:state?.chats.find(c=>c.id===chatId),humanState=human?humanData():null,originalHumanMessages=human?humanState.messages:null;

  const messages=human?humanState.messages.filter(m=>m.sender===chatId.slice(6)||m.recipient===chatId.slice(6)):ch?.messages,total=messages?.length||0;

  if(chatId&&!baseline.has(chatId)){baseline.set(chatId,total);limit.set(chatId,Math.min(50,total));}

  // Keep every message already visible during this visit, including new live messages.

  const count=Math.min(total,(limit.get(chatId)||50)+Math.max(0,total-(baseline.get(chatId)??total)));

  if(messages&&total>count){if(human){const ids=new Set(messages.slice(-count).map(m=>m.id));humanState.messages=humanState.messages.filter(m=>m.sender!==chatId.slice(6)&&m.recipient!==chatId.slice(6)||ids.has(m.id));}else ch.messages=messages.slice(-count);}

  try{before();}finally{if(human&&originalHumanMessages)humanState.messages=originalHumanMessages;else if(messages&&ch)ch.messages=messages;}

  const n=document.querySelector('.message-scroll');if(!n)return;n.dataset.chatId=chatId;

  if(total>count&&loading.has(chatId))n.insertAdjacentHTML('afterbegin','<div class="history-loading" role="status"><span class="history-spinner"></span><span>正在載入較早訊息…</span></div>');

  const s={node:n,follow:saved?.follow??true,anchor:saved?.anchor||null,top:saved?.top||0,observer:null,events:new AbortController(),interacting:!!saved?.interacting};session=s;

  place(s);

  if(focus){const field=document.querySelector('.composer textarea');field?.focus({preventScroll:true});field?.setSelectionRange(start,end);place(s);}

  // iOS/WKWebView may delay scroll events until the finger is lifted. Never fight a touch
  // by forcing scrollTop to the bottom from a ResizeObserver or image load handler.
  let userUntil=0, settleTimer=0;
  const snapshot=()=>{if(session!==s)return;s.top=n.scrollTop;s.anchor=anchor(n);s.follow=n.scrollHeight-n.clientHeight-n.scrollTop<32;};
  const begin=()=>{
    s.interacting=true;window.MizukiChatUserScrolling=true;s.follow=false;userUntil=performance.now()+1500;
    clearTimeout(settleTimer);
  };
  const finishGesture=()=>{
    if(session!==s)return;
    s.interacting=false;window.MizukiChatUserScrolling=false;snapshot();
    if(window.MizukiDeferredChatRender){window.MizukiDeferredChatRender=false;render();}
  };
  const settle=()=>{
    clearTimeout(settleTimer);
    // A touchend is not the end of momentum scrolling on iOS.
    settleTimer=setTimeout(finishGesture,400);
  };
  n.addEventListener('touchstart',begin,{passive:true,signal:s.events.signal});
  n.addEventListener('touchmove',()=>{userUntil=performance.now()+1300;settle();},{passive:true,signal:s.events.signal});
  n.addEventListener('touchend',settle,{passive:true,signal:s.events.signal});
  n.addEventListener('touchcancel',settle,{passive:true,signal:s.events.signal});
  for(const e of ['wheel','pointerdown','keydown'])n.addEventListener(e,()=>{begin();settle();},{passive:true,signal:s.events.signal});
  let loadingEarlier=false;
  n.addEventListener('scroll',()=>{
    // Keep the momentum gesture active until 400 ms without scroll movements.
    if(s.interacting){snapshot();settle();}
    else if(performance.now()<userUntil){snapshot();}
    else return;
    if(n.scrollTop<64&&total>count&&!loadingEarlier){
      loadingEarlier=true;actions.loadEarlier?.().finally(()=>{loadingEarlier=false;});
    }
  },{passive:true,signal:s.events.signal});

  s.observer=new ResizeObserver(()=>place(s));s.observer.observe(n);for(const item of n.children)s.observer.observe(item);

  for(const img of n.querySelectorAll('img'))img.addEventListener('load',()=>place(s),{once:true});requestAnimationFrame(()=>place(s));

 };

 window.resetChatHistoryWindow=id=>{if(id){limit.delete(id);baseline.delete(id);return;}if(chatId){limit.delete(chatId);baseline.delete(chatId);}};

 window.revealChatMessage=id=>{const human=isHumanChat(),messages=human?humanData().messages.filter(m=>m.sender===chatId.slice(6)||m.recipient===chatId.slice(6)):state.chats.find(c=>c.id===chatId)?.messages,index=messages?.findIndex(m=>String(m.id)===String(id));if(index>=0){const total=messages.length;baseline.set(chatId,total);limit.set(chatId,Math.min(total,Math.max(50,total-index+5)));}render();requestAnimationFrame(()=>{const n=document.querySelector('.message-scroll'),row=n?.querySelector('[data-message-id="'+CSS.escape(human?'human-'+id:id)+'"]');if(row){row.scrollIntoView({block:'center',behavior:'instant'});if(session){session.follow=false;session.top=n.scrollTop;session.anchor=anchor(n);}row.classList.add('message-highlight');setTimeout(()=>row.classList.remove('message-highlight'),1400);}});};

 actions.loadEarlier=()=>{const id=chatId,total=isHumanChat()?humanData().messages.filter(m=>m.sender===id.slice(6)||m.recipient===id.slice(6)).length:state?.chats.find(c=>c.id===id)?.messages.length||0;if(loading.has(id)||total<=(limit.get(id)||50))return Promise.resolve();loading.add(id);render();return new Promise(resolve=>setTimeout(()=>{if(id===chatId){limit.set(id,Math.min(total,(limit.get(id)||50)+50));loading.delete(id);render();}else loading.delete(id);resolve();},420));};

 if(state)render();

};

if(window.DesktopUIReady)window.installStableChat();

