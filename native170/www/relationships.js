'use strict';
const relationTypes={
  couple:{label:'情侶',aiRole:'使用者的伴侶',userRole:'AI 的伴侶'},
  brothers:{label:'兄弟',aiRole:'使用者的兄弟',userRole:'AI 的兄弟'},
  family:{label:'家人',aiRole:'使用者的家人',userRole:'AI 的家人'},
  sisters:{label:'姐妹',aiRole:'使用者的姐妹',userRole:'AI 的姐妹'},
  child:{label:'子女',aiRole:'使用者的孩子',userRole:'AI 的家長'},
  parent:{label:'家長',aiRole:'使用者的家長',userRole:'AI 的孩子'},
  friends:{label:'朋友',aiRole:'使用者的朋友',userRole:'AI 的朋友'},
  custom:{label:'自訂',aiRole:'',userRole:''}
};
function relationshipLabel(a){return a.relationship?.label||'尚未綁定';}
function relationEntry(id){const a=ai(id);return `<button class="relationship-entry full" data-relationship="${esc(id)}"><span class="setting-icon">${icon('heart')}</span><span><strong>關係綁定</strong><span class="small">${esc(relationshipLabel(a))}${a.relationship?' · '+esc(new Date(a.relationship.since).toLocaleDateString('zh-TW')):''}</span></span><span class="spacer"></span><span class="chevron">›</span></button>`;}
function captureRelationReturn(){
  if($('#contactName'))return {kind:'contact',id:modal.aiId,name:$('#contactName').value,personality:$('#contactPersonality').value,category:$('#contactCategory').value,favorite:$('#contactFavorite').checked,avatar:modal.avatar};
  if($('#summaryText'))return {kind:'memory',id:modal.aiId,summary:$('#summaryText').value,memory:modal.memory};
  if(chatId)return {kind:'chat'};return null;
}
function relationshipDraft(){return {type:document.querySelector('[data-relation-type].selected')?.dataset.relationType||'couple',label:$('#relationLabel')?.value||'',aiRole:$('#relationAiRole')?.value||'',userRole:$('#relationUserRole')?.value||'',callAi:$('#relationCallAi')?.value||'',callUser:$('#relationCallUser')?.value||'',notes:$('#relationNotes')?.value||''};}
function relationshipModal(id,values=null,back=null){
  const a=ai(id),r=a.relationship;
  const d=values||{type:r?.type||'couple',label:r?.type==='custom'?r.label:'',aiRole:r?.type==='custom'?r.aiRole:'',userRole:r?.type==='custom'?r.userRole:'',callAi:r?.callAi||'',callUser:r?.callUser||'',notes:r?.notes||''};
  const selected=relationTypes[d.type]||relationTypes.couple;
  showModal('與'+a.name+'的關係',`<div class="relation-intro">${avatar(a,'large')}<div><h3>${esc(a.name)}</h3><p class="small">目前：${esc(relationshipLabel(a))}</p>${r?`<p class="small">綁定於 ${esc(new Date(r.since).toLocaleDateString('zh-TW'))}</p>`:''}</div></div><p class="help">每位 AI 可獨立設定一段關係，可隨時修改或解除。關係、稱呼與相處約定會帶入對話與記憶提示，不會改動固定外貌。</p><label>選擇關係</label><div class="relationship-grid">${Object.entries(relationTypes).map(([key,p])=>`<button class="pill ${d.type===key?'selected':''}" data-relation-type="${key}">${esc(p.label)}</button>`).join('')}</div>${d.type==='custom'?`<label for="relationLabel">自訂關係名稱</label><input id="relationLabel" maxlength="40" value="${esc(d.label)}" placeholder="例如：師徒、摯友、靈魂搭檔"><label for="relationAiRole">AI 是你的…（選填）</label><input id="relationAiRole" maxlength="80" value="${esc(d.aiRole)}" placeholder="例如：老師"><label for="relationUserRole">你是 AI 的…（選填）</label><input id="relationUserRole" maxlength="80" value="${esc(d.userRole)}" placeholder="例如：學生"><p class="small">未填彼此身分時，會以自訂關係名稱作為相處依據。</p>`:`<div class="relation-direction"><span>AI：${esc(selected.aiRole)}</span><span>你：${esc(selected.userRole)}</span></div>`}<label for="relationCallAi">我怎麼稱呼 AI（選填）</label><input id="relationCallAi" maxlength="40" value="${esc(d.callAi)}" placeholder="例如：沐沐、哥哥"><label for="relationCallUser">AI 怎麼稱呼我（選填）</label><input id="relationCallUser" maxlength="40" value="${esc(d.callUser)}" placeholder="填入你喜歡的稱呼"><label for="relationNotes">相處約定（選填）</label><textarea id="relationNotes" maxlength="1000" rows="4" placeholder="例如：早晚安要互道問候；難過時先陪我聊一會兒。">${esc(d.notes)}</textarea><p class="help">「子女」表示 AI 是你的孩子；「家長」則相反。關係不預設年齡。設定只影響 App 內互動，模型的實際回應仍可能偏離提示。</p><div class="sheet-actions"><button class="pill" data-action="relationshipBack">返回</button><button class="pill primary" data-bindrelationship="${esc(id)}">${r?'儲存關係':'確認綁定'}</button></div>${r?`<button class="link-button danger" data-unbindrelationship="${esc(id)}">解除關係綁定</button>`:''}`);
  modal.relationAI=id;modal.relationReturn=back;
}
function returnFromRelationship(back=modal?.relationReturn){
  if(back?.kind==='contact'){
    contactModal(back.id);$('#contactName').value=back.name;$('#contactPersonality').value=back.personality;$('#contactCategory').value=back.category;$('#contactFavorite').checked=back.favorite;modal.avatar=back.avatar;
    document.querySelector(`[data-contactavatar="${CSS.escape(back.id)}"]`).innerHTML=avatar({...ai(back.id),avatar:back.avatar},'large');
  }else if(back?.kind==='memory'){
    memoryModal(back.id);$('#summaryText').value=back.summary;modal.memory=back.memory;$('#individualLimits').innerHTML=memoryButtons(back.memory,'data-indlimit');
  }else if(back?.kind==='chat')chatOptions();else closeModal();
}
actions.relationshipBack=()=>returnFromRelationship();
const closeBeforeRelationship=actions.closeModal;
actions.closeModal=()=>{if(modal?.relationCancel){const c=modal.relationCancel;relationshipModal(c.id,c.values,c.back);}else if(modal?.relationAI)returnFromRelationship();else closeBeforeRelationship();};
const contactBeforeRelationship=contactModal;
contactModal=function(id){contactBeforeRelationship(id);$('.profile-edit').insertAdjacentHTML('afterend',relationEntry(id));};
const memoryBeforeRelationship=memoryModal;
memoryModal=function(id){memoryBeforeRelationship(id);$('.sheet-title').insertAdjacentHTML('afterend',relationEntry(id));};
const chatOptionsBeforeRelationship=chatOptions;
chatOptions=function(){chatOptionsBeforeRelationship();const ch=state.chats.find(c=>c.id===chatId);$('#modalError').insertAdjacentHTML('beforebegin',`<div class="card"><h3>我們的關係</h3>${ch.members.map(id=>relationEntry(id)).join('')}</div>`);};
actions.chatOptions=chatOptions;
const renderBeforeRelationship=render;
render=function(){
  renderBeforeRelationship();if(!state)return;
  document.querySelectorAll('[data-contact]').forEach(button=>{const a=ai(button.dataset.contact);if(a.relationship)button.insertAdjacentHTML('beforeend',`<span class="relationship-badge">${esc(a.relationship.label)}</span>`);});
  const ch=state.chats.find(c=>c.id===chatId);
  if(ch?.members.length===1&&ai(ch.members[0]).relationship){const subtitle=document.querySelector('.conversation .top .small');if(subtitle)subtitle.textContent=relationshipLabel(ai(ch.members[0]))+' · '+ai(ch.members[0]).name;}
  if(isMoments()&&momentProfileId!=='me'&&ai(momentProfileId).relationship){document.querySelector('.moment-profile h3')?.insertAdjacentHTML('afterend',`<span class="relationship-badge">${esc(relationshipLabel(ai(momentProfileId)))}</span>`);}
};
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  try{
    if(button.dataset.relationship){const back=captureRelationReturn();relationshipModal(button.dataset.relationship,null,back);}
    if(button.dataset.relationType){const id=modal.relationAI,back=modal.relationReturn,draft=relationshipDraft();draft.type=button.dataset.relationType;relationshipModal(id,draft,back);}
    if(button.dataset.bindrelationship){const id=button.dataset.bindrelationship,back=modal.relationReturn;button.disabled=true;try{await mutate('relationship',{id,...relationshipDraft()});render();returnFromRelationship(back);toast('關係已綁定',1000);}finally{button.disabled=false;}}
    if(button.dataset.unbindrelationship){const id=button.dataset.unbindrelationship,back=modal.relationReturn,values=relationshipDraft();confirmModal('解除關係綁定','只解除目前關係，保留聊天、記憶與固定外貌；之後可重新綁定。',async()=>{await mutate('relationship',{id,unbind:true});render();returnFromRelationship(back);toast('已解除關係綁定',1000);});modal.relationCancel={id,values,back};}
  }catch(error){modalError(error);}
});
const backBeforeRelationship=window.goBack;
window.goBack=function(){if(modal?.relationCancel){actions.closeModal();return true;}if(modal?.relationAI){returnFromRelationship();return true;}return backBeforeRelationship();};
if(state)render();
