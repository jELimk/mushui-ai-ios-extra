'use strict';

let coverExpanded=false, momentsRefreshing=false, pullGesture=null, momentProfileId='me';
const expandedMomentTexts=new Set();
let pullStatus='', pullStatusTimer, coverClickBlockedUntil=0;
const isMoments=()=>tab==='moments'&&!page&&!chatId;
const baseCoverHeight=()=>innerWidth>=650?300:235;
function fullCoverHeight(){
  const image=document.querySelector('[data-moment-cover] img');
  const width=document.querySelector('[data-moment-cover]')?.clientWidth||innerWidth;
  const natural=image?.naturalWidth?width*image.naturalHeight/image.naturalWidth:innerHeight-150;
  return Math.max(baseCoverHeight(),natural+115);
}
function positionCover(expanded,extra=0){
  const cover=document.querySelector('[data-moment-cover]');
  if(!cover)return;
  cover.classList.toggle('is-expanded',expanded);
  document.querySelector('.moments-view')?.classList.toggle('cover-revealed',expanded);
  cover.style.height=((expanded?fullCoverHeight():baseCoverHeight())+extra)+'px';
  cover.setAttribute('aria-expanded',String(expanded));
  const collapse=document.querySelector('[data-action="collapseCover"]');
  if(collapse)collapse.hidden=!expanded;
}
function momentCommentName(id){
 const h=humanData(),raw=String(id||''),peer=raw.startsWith('human:')?raw.slice(6):raw,own=raw==='me'||(h.me?.id&&peer===h.me.id),role=state.ais.find(a=>a.id===raw),friend=!own&&!role?h.friends.find(p=>p.id===peer):null,p=own?person('me'):role||friend||person(raw);
 return `<button type="button" class="comment-profile-name" ${own?'data-action="ownProfile"':friend?'data-humancontact="'+esc(friend.id)+'"':'data-momentprofile="'+esc(raw)+'"'} aria-label="查看${esc(p.name)}的個人頁面">${esc(p.name)}</button>`;
}
function setPullStatus(text){
  pullStatus=text;
  const status=document.querySelector('.moments-pull-status');
  if(status){status.textContent=text;status.classList.toggle('visible',!!text);status.classList.toggle('refreshing',momentsRefreshing);}
}
momentsView=function(){
  const own=momentProfileId==='me',official=momentProfileId==='official-mushui',profile=own?{...person('me'),cover:state.settings.cover,bio:state.settings.bio}:official?{...person('official-mushui'),bio:'沐水官方帳號'}:ai(momentProfileId);
  const posts=state.moments.filter(p=>own||p.author===momentProfileId).slice().sort((a,b)=>b.time-a.time);
  return `<section class="moments-view"><div style="position:relative"><div class="cover ${coverExpanded?'is-expanded':''}" data-moment-cover role="button" tabindex="0" aria-label="${own?'更換朋友圈背景':official?'沐水官方帳號':'查看 AI 朋友圈背景'}" aria-expanded="${coverExpanded}">${profile.cover?`<img src="${esc(profile.cover)}" alt="${own?'我的':esc(profile.name)+'的'}朋友圈封面">`:''}<span class="cover-edit-hint">${own?'點一下，更換背景':official?'沐水官方帳號':'AI 自己的背景 · 下拉查看完整圖片'}</span></div><div class="moments-pull-status ${pullStatus?'visible':''} ${momentsRefreshing?'refreshing':''}" role="status" aria-live="polite">${esc(pullStatus)}</div><button class="collapse-cover" data-action="collapseCover" ${coverExpanded?'':'hidden'}>收起封面 ${icon('back')}</button><header class="top moment-top"><div class="between"><div class="moment-heading">${own?'':btn('momentsHome','back',momentReturnChat?'返回聊天室':'返回朋友圈')}<h1>${own?'朋友圈':esc(profile.name)+'的朋友圈'}</h1></div><div class="header-actions">${own?btn('compose','camera','發朋友圈'):official?'':btn('profileChat','chat','與這位 AI 聊天')}</div></div></header></div><div class="moment-profile"><div style="text-align:right"><h3>${own?`<button class="profile-name-button" data-action="ownProfile" aria-label="查看我的個人頁面">${esc(profile.name)}</button>`:esc(profile.name)}</h3><p class="small">${esc(profile.bio||(official?'官方更新與服務公告':'AI 的小小日常'))}</p></div>${own?`<button data-action="ownProfile" aria-label="查看我的個人頁面">${avatar(profile,'large')}</button>`:avatar(profile,'large')}</div><div class="content">${posts.length?posts.map(p=>{const expanded=expandedMomentTexts.has(p.id),long=(p.text||'').length>150;return `<article class="moment"><button class="moment-author" ${p.author==='me'?'data-action="ownProfile"':'data-momentprofile="'+esc(p.author)+'"'} aria-label="查看${esc(person(p.author).name)}的朋友圈">${avatar(person(p.author))}</button><div class="moment-main"><h3>${p.author==='me'?`<button class="profile-name-button" data-action="ownProfile">${esc(person(p.author).name)}</button>`:esc(person(p.author).name)}</h3><p class="text moment-text ${long&&!expanded?'is-collapsed':''}">${esc(p.text)}</p>${long?`<button class="moment-expand" data-momentexpand="${esc(p.id)}">${expanded?'收起':'下拉查看全文'}　${icon(expanded?'back':'more')}</button>`:''}${photos(p.images,!!p.spoilerImages,p.id)}${momentReplyStatus(p)}<div class="meta"><span>${ago(p.time)}</span>${p.visibleTo?`<span class="visibility-label">${esc(audienceLabel(p))}</span>`:''}<span class="spacer"></span>${p.author==='me'?`<button data-deletepost="${esc(p.id)}" aria-label="刪除朋友圈">${icon('trash')}</button>`:''}<button data-like="${esc(p.id)}" aria-label="${p.likes.includes('me')?'取消讚':'讚'}">${icon('heart')}${p.likes.includes('me')?' 已讚':''}</button><button data-comment="${esc(p.id)}" aria-label="留言">${icon('comment')}</button></div>${p.likes.length||p.comments.length?`<div class="comments">${p.likes.length?`<p class="accent">♡ ${p.likes.map(id=>esc(person(id).name)).join('、')}</p>`:''}${p.comments.map(c=>`<p>${momentCommentName(c.author)}：${esc(c.text)}</p>`).join('')}</div>`:''}</div></article>`;}).join(''):`<div class="empty" style="padding-top:28px"><span class="accent">${icon('moments')}</span><h2 style="margin-top:18px;font-size:calc(19px * var(--text-scale,1))">${official?'官方朋友圈':own?'把日常，留在這裡':'這裡的故事，慢慢開始'}</h2><p>${own?'一張照片，或一點心情。<br>點右上角相機，分享第一則朋友圈。':official?'版本更新摘要會發佈在這裡。':'這位 AI 還沒有發朋友圈。'}</p></div>`}</div></section>`;
};
const renderBeforePull=render;
render=function(){
  renderBeforePull();
  if(isMoments())positionCover(coverExpanded);
  else{coverExpanded=false;pullGesture=null;if(tab!=='moments')momentProfileId='me';}
};

// Refresh reads persisted local posts, including AI background posts. It never requests an AI generation.
actions.refreshMoments=async()=>{
  if(momentsRefreshing)return;
  momentsRefreshing=true;clearTimeout(pullStatusTimer);setPullStatus('正在刷新…');
  try{
    const next=await call('load');state=next;
    if(draft&&!dirty)draft.cover=next.settings.cover;
    if(isMoments()){render();document.querySelector('.page')?.scrollTo(0,0);}
    setPullStatus('已刷新');
  }catch(error){setPullStatus('刷新失敗，請重試');toast(error.message);}
  finally{
    momentsRefreshing=false;
    document.querySelector('.moments-pull-status')?.classList.remove('refreshing');
    pullStatusTimer=setTimeout(()=>setPullStatus(''),900);
  }
};
actions.cover=async()=>{
  if(momentProfileId!=='me'){coverExpanded=true;positionCover(true);return;}
  const image=await pickImage();if(!image)return;
  await mutate('setCover',{image});
  if(draft)draft.cover=image;
  if(isMoments())render();
  toast('朋友圈背景已更換',1000);
};
actions.collapseCover=()=>{coverExpanded=false;positionCover(false);};
actions.momentsHome=()=>{if(momentReturnChat&&(state.chats.some(c=>c.id===momentReturnChat)||momentReturnChat.startsWith('human:'))){chatId=momentReturnChat;momentReturnChat='';momentProfileId='me';tab='chats';page='';coverExpanded=false;render();return;}momentProfileId='me';coverExpanded=false;render();document.querySelector('.page')?.scrollTo(0,0);};
actions.profileChat=async()=>{momentReturnChat='';if(momentProfileId==='me')return;if(momentProfileId==='official-mushui'){tab='chats';chatId='human:official-mushui';render();return;}const r=await mutate('newChat',{members:[momentProfileId],title:''});chatId=r.chatId;render();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-momentexpand]');if(!b)return;const id=b.dataset.momentexpand;if(expandedMomentTexts.has(id))expandedMomentTexts.delete(id);else expandedMomentTexts.add(id);render();});
actions.openOfficialMoments=()=>{momentReturnChat=chatId==='human:official-mushui'?chatId:'';momentProfileId='official-mushui';tab='moments';page='';chatId='';coverExpanded=false;render();};

function pullStart(x,y,target){
  if(!isMoments()||modal||momentsRefreshing||(document.querySelector('.page')?.scrollTop||0)>1||!target.closest('.moments-view'))return;
  if(target.closest('button,input,textarea,select,a'))return;
  clearTimeout(pullStatusTimer);
  pullGesture={x,y,distance:0,dragging:false,expandedAtStart:coverExpanded};
}
function coverPullLimit(){return Math.max(260,(fullCoverHeight()-baseCoverHeight())/.65);}
function pullMove(x,y,event){
  if(!pullGesture||!isMoments())return;
  const dy=y-pullGesture.y,dx=x-pullGesture.x;
  if(!pullGesture.dragging&&(Math.abs(dx)>Math.abs(dy)+8||dy<-8)){pullGesture=null;return;}
  if(dy<8&&!pullGesture.dragging)return;
  if((document.querySelector('.page')?.scrollTop||0)>1&&!pullGesture.dragging){pullGesture=null;return;}
  if(event.cancelable)event.preventDefault();
  pullGesture.dragging=true;pullGesture.distance=Math.max(0,dy);
  const reveal=pullGesture.expandedAtStart||dy>=coverPullLimit();
  const cover=document.querySelector('[data-moment-cover]');
  cover?.classList.add('is-pulling');
  if(reveal)positionCover(true,Math.min(25,Math.max(0,dy-coverPullLimit())*.12));
  else positionCover(false,Math.min(fullCoverHeight()-baseCoverHeight(),Math.max(0,dy)*.65));
  setPullStatus(dy>=coverPullLimit()?'放開查看完整封面並刷新':dy>=64?'放開以刷新，繼續下拉看完整封面':'下拉刷新');
}
function pullEnd(cancelled=false){
  const gesture=pullGesture;pullGesture=null;if(!gesture)return;
  document.querySelector('[data-moment-cover]')?.classList.remove('is-pulling');
  if(gesture.dragging)coverClickBlockedUntil=performance.now()+500;
  if(cancelled||gesture.distance<64){coverExpanded=gesture.expandedAtStart;positionCover(coverExpanded);setPullStatus('');return;}
  coverExpanded=gesture.expandedAtStart||gesture.distance>=coverPullLimit();
  positionCover(coverExpanded);actions.refreshMoments();
}
document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1){pullEnd(true);return;}
  pullStart(e.touches[0].clientX,e.touches[0].clientY,e.target);
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(e.touches.length!==1){pullEnd(true);return;}
  pullMove(e.touches[0].clientX,e.touches[0].clientY,e);
},{passive:false});
document.addEventListener('touchend',()=>pullEnd(false));
document.addEventListener('touchcancel',()=>pullEnd(true));
document.addEventListener('click',async e=>{
  if(!e.target.closest('[data-moment-cover]')||e.target.closest('button'))return;
  e.preventDefault();
  if(performance.now()<coverClickBlockedUntil)return;
  try{await actions.cover();}catch(error){toast(error.message);}
});
document.addEventListener('keydown',async e=>{
  if(!e.target.matches('[data-moment-cover]')||!['Enter',' '].includes(e.key))return;
  e.preventDefault();try{await actions.cover();}catch(error){toast(error.message);}
});
document.addEventListener('load',e=>{if(coverExpanded&&e.target.matches('[data-moment-cover] img'))positionCover(true);},true);
window.addEventListener('resize',()=>{if(isMoments())positionCover(coverExpanded);});
if(state)render();
