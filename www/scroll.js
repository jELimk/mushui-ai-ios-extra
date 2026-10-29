'use strict';
// One owner restores scroll only after all decorators (cards, invites, headers) finish.
let chatViewport=null;
const renderBeforeViewport=render;
function captureChatAnchor(node){
  const top=node.getBoundingClientRect().top;
  const message=[...node.querySelectorAll('[data-message-id]')].find(m=>m.getBoundingClientRect().bottom>top+1);
  return message?{id:message.dataset.messageId,offset:message.getBoundingClientRect().top-top}:null;
}
function placeChatViewport(session){
  if(chatViewport!==session||!session.node.isConnected)return;
  const node=session.node;
  if(session.follow){node.scrollTop=Math.max(0,node.scrollHeight-node.clientHeight);session.top=node.scrollTop;return;}
  const item=session.anchor&&node.querySelector(`[data-message-id="${CSS.escape(session.anchor.id)}"]`);
  const target=item?node.scrollTop+item.getBoundingClientRect().top-node.getBoundingClientRect().top-session.anchor.offset:session.top;
  node.scrollTop=target;session.top=node.scrollTop;
}
render=function(){
  const previous=document.querySelector('.message-scroll');
  const same=previous&&previous.dataset.chatId===chatId;
  const saved=same?{follow:previous.scrollHeight-previous.clientHeight-previous.scrollTop<=24,anchor:captureChatAnchor(previous),top:previous.scrollTop}:null;
  chatViewport?.observer?.disconnect();chatViewport=null;
  renderBeforeViewport();
  const node=document.querySelector('.message-scroll');if(!node)return;
  const session={node,follow:saved?.follow??true,anchor:saved?.anchor||null,top:saved?.top||0,observer:null};
  chatViewport=session;
  placeChatViewport(session);
  node.addEventListener('scroll',()=>{
    if(chatViewport!==session)return;
    session.follow=node.scrollHeight-node.clientHeight-node.scrollTop<=24;
    session.top=node.scrollTop;
    session.anchor=captureChatAnchor(node);
  },{passive:true});
  // Late photos, fonts, cards, composer resizing and keyboard insets retain the same intent.
  session.observer=new ResizeObserver(()=>placeChatViewport(session));
  session.observer.observe(node);const list=node.querySelector('.message-list');if(list)session.observer.observe(list);
};
if(state)render();
