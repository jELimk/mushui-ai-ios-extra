'use strict';
let momentReturnChat='';
Object.assign(featureDefaults,{autoIdentityImages:false,allowImageInvites:false,virtualCards:true});
paths.gift='M3 8h18v4H3Z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3Z M12 8h4a3 3 0 1 0-3-3Z';
const imageSettingsBeforeSocial=imageSettingsView;
imageSettingsView=function(){return imageSettingsBeforeSocial()+`<div class="card"><h3>AI 自己的圖片與邀請</h3>${toggle('autoIdentityImages','允許 AI 自行換頭像與朋友圈背景','需同時開啟圖片生成。AI 會依個性與聊天情境偶爾替自己生成並換上新圖片，外貌原文保持鎖定。')}${toggle('allowImageInvites','允許 AI 邀請我換圖片','AI 可以提出頭像或背景圖片邀請；你預覽並確認後才會更換，也可以拒絕或自行選圖。')}<p class="feature-note">此功能必須使用可生成圖片的模型才可使用。</p><p class="help">這兩項預設關閉，開啟後 AI 會依個性自行決定是否換圖，使用者提出要求也不保證換圖。從聯絡人或朋友圈頭像可查看每位 AI 的朋友圈。AI 更換圖片不會改寫其固定外貌描述，但生成細節仍可能有偏差。</p></div>`;};
const lifeBeforeSocial=lifePage;
lifePage=function(){return lifeBeforeSocial()+`<div class="card">${toggle('virtualCards','虛擬轉帳與送禮','允許 AI 依聊天情境偶爾送出虛擬卡片，你可領取或婉拒。')}<p class="feature-note">僅 App 內顯示，無真實金流、購買、寄送或實際贈送。</p><p class="help">轉帳使用虛擬「沐水幣」，不連接任何銀行、錢包或支付服務。沒有真實價值、無法提領。禮物是聊天中的虛擬心意，不會產生訂單。是否送出由聊天模型依個性與情境決定，這不是每天保證送出的獎勵。</p></div>`;};
const contactBeforeSocial=contactModal;
contactModal=function(id){contactBeforeSocial(id);$('#modalError').insertAdjacentHTML('beforebegin',`<button class="pill full" data-momentprofile="${esc(id)}">${icon('moments')}　看看${esc(ai(id).name)}的朋友圈</button>`);};
function virtualCardHtml(m){
  const c=m.virtualCard;if(!c)return '';
  const transfer=c.type==='transfer',pending=c.status==='pending';
  return `<div class="virtual-card" data-virtual-card="${esc(m.id)}"><div class="flex">${icon(transfer?'cloud':'gift')}<strong>${transfer?'虛擬轉帳':'虛擬禮物'}</strong></div><div class="virtual-value">${transfer?esc(c.amount)+' <small>沐水幣</small>':esc(c.title)}</div>${c.note?`<p>${esc(c.note)}</p>`:''}<div class="virtual-disclaimer">僅 App 內顯示 · 無真實金流或贈送</div>${pending?`<div class="card-actions"><button class="pill primary" data-cardaccept="${esc(m.id)}">${transfer?'領取心意':'收下禮物'}</button><button class="link-button" data-carddecline="${esc(m.id)}">婉拒</button></div>`:`<div class="small">${c.status==='accepted'?'已收下這份虛擬心意':'已婉拒'}</div>`}</div>`;
}
function invitationHtml(m){
  const invite=m.imageInvite;if(!invite)return '';
  const pending=invite.status==='pending',label=invite.target==='avatar'?'頭像':'朋友圈背景';
  return `<div class="image-invitation"><strong>邀請你更換${label}</strong><p class="small">由你決定，確認後才會更換你的圖片。</p>${pending?`<div class="card-actions">${m.images?.length?`<button class="pill primary" data-acceptinvite="${esc(m.id)}">預覽並使用</button>`:''}<button class="pill" data-custominvite="${esc(m.id)}">自己選圖</button><button class="link-button" data-dismissinvite="${esc(m.id)}">暫時不用</button></div>`:`<p class="small">${invite.status==='accepted'?'已更換':'這次先不換'}</p>`}</div>`;
}
const renderBeforeSocial=render;
render=function(){
  renderBeforeSocial();if(!chatId)return;
  const ch=state.chats.find(c=>c.id===chatId);if(!ch)return;
  for(const m of ch.messages){if(!m.id)continue;const bubble=document.querySelector(`[data-message-id="${CSS.escape(m.id)}"] .bubble`);if(bubble)bubble.insertAdjacentHTML('beforeend',virtualCardHtml(m)+invitationHtml(m));}
};
const chatOptionsBeforeSocial=chatOptions;
chatOptions=function(){chatOptionsBeforeSocial();const ch=state.chats.find(c=>c.id===chatId);$('#modalError').insertAdjacentHTML('beforebegin',`<div class="card"><h3>讓 AI 決定自己的圖片</h3><p class="help">這會提供一次自主判斷機會，AI 可以不換，也可以自行決定圖片用途。需開啟生圖及自主換圖、設定可用模型並儲存，會使用 API 額度。僅更新該 AI 自己的圖片，不會改動你的圖片或固定外貌。</p>${ch.members.map(id=>`<div class="social-ai-row"><span>${esc(ai(id).name)}</span><button class="pill" data-designai="${esc(id)}" data-kind="avatar">考慮換圖</button></div>`).join('')}</div>`);};
actions.chatOptions=chatOptions;
async function updateInvite(messageId,extra={}){await mutate('imageInvite',{id:chatId,messageId,...extra});if(draft){draft.avatar=state.settings.avatar;draft.cover=state.settings.cover;}closeModal();render();}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  try{
    if(b.dataset.momentprofile){if(chatId)momentReturnChat=chatId;else if(tab!=='moments')momentReturnChat='';const id=b.dataset.momentprofile;if(id!=='me'&&!state.ais.some(a=>a.id===id)){toast('這位 AI 已移除');return;}closeModal();await navigate('moments');if(tab==='moments'){momentProfileId=id;coverExpanded=false;render();window.scrollTo(0,0);}}
    if(b.dataset.cardaccept||b.dataset.carddecline){await mutate('virtualCard',{id:chatId,messageId:b.dataset.cardaccept||b.dataset.carddecline,decline:!!b.dataset.carddecline});render();toast(b.dataset.carddecline?'已婉拒這份虛擬心意':'已收下虛擬心意，沒有真實金流',1200);}
    if(b.dataset.dismissinvite)await updateInvite(b.dataset.dismissinvite,{dismiss:true});
    if(b.dataset.custominvite){const id=b.dataset.custominvite,image=await pickImage();if(image){await updateInvite(id,{image});toast('圖片已更換',1000);}}
    if(b.dataset.acceptinvite){const id=b.dataset.acceptinvite,ch=state.chats.find(c=>c.id===chatId),m=ch.messages.find(m=>m.id===id);showModal('預覽圖片邀請',`<img class="photo-view" src="${esc(m.images[0])}" alt="AI 邀請使用的圖片"><p class="help">套用後會更換你的${m.imageInvite.target==='avatar'?'頭像':'朋友圈背景'}，不會影響 AI 的固定外貌。</p><div class="sheet-actions"><button class="pill" data-action="closeModal">再想想</button><button class="pill primary" data-applyinvite="${esc(id)}">確認套用</button></div>`);}
    if(b.dataset.applyinvite){await updateInvite(b.dataset.applyinvite);toast('圖片已更換',1000);}
    if(b.dataset.designai){const id=chatId,aiId=b.dataset.designai;if(sending.has(id))throw Error('AI 正在回覆，請稍候');closeModal();sending.add(id);render();try{const r=await call('generate',{id,aiId,kind:b.dataset.kind});state=r.state;toast(r.skipped?'這次沒有更換圖片':'AI 的圖片已更新',1200);}finally{sending.delete(id);render();}}
  }catch(error){modalError(error);}
});
const backBeforeSocial=window.goBack;
window.goBack=function(){if(!modal&&isMoments()&&coverExpanded){actions.collapseCover();return true;}if(!modal&&isMoments()&&momentProfileId!=='me'){actions.momentsHome();return true;}return backBeforeSocial();};
if(state)render();
