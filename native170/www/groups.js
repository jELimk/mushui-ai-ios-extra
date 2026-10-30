'use strict';
const optionsBeforeGroupAvatar=chatOptions;
chatOptions=function(){optionsBeforeGroupAvatar();const ch=state.chats.find(c=>c.id===chatId);if(ch?.members.length>1)document.querySelector('#modalError').insertAdjacentHTML('beforebegin',`<div class="card"><h3>群組頭像</h3><div class="group-avatar-preview">${chatAvatar(ch,'large')}</div><p class="help">預設顯示包含你在內的成員拼圖，最多顯示 9 位；成員頭像更新時會一起更新。也可選擇自訂圖片。</p><div class="sheet-actions"><button class="pill primary" data-action="groupAvatar">選擇群頭像</button><button class="pill" data-action="resetGroupAvatar">恢復成員拼圖</button></div></div>`);};
actions.chatOptions=chatOptions;
actions.groupAvatar=async()=>{const id=chatId,image=await pickImage();if(!image)return;await mutate('groupAvatar',{id,image});render();chatOptions();toast('群組頭像已更新',1100);};
actions.resetGroupAvatar=async()=>{await mutate('groupAvatar',{id:chatId,image:''});render();chatOptions();toast('已恢復成員頭像拼圖',1100);};
const renderBeforeGroups=render;
render=function(){renderBeforeGroups();const ch=state.chats.find(c=>c.id===chatId);if(ch?.members.length===1)document.querySelector('.conversation .top .spacer')?.insertAdjacentHTML('beforebegin',`<button class="group-header-avatar" data-momentprofile="${esc(ch.members[0])}" aria-label="查看 AI 個人頁面">${avatar(ai(ch.members[0]))}</button>`);if(ch?.members.length>1)document.querySelector('.conversation .top .spacer')?.insertAdjacentHTML('beforebegin',`<button class="group-header-avatar" data-action="chatOptions" aria-label="群組頭像與設定">${chatAvatar(ch)}</button>`);};
if(state)render();
