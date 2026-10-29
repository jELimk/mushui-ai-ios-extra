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
