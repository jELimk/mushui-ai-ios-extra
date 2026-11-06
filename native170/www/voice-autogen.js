'use strict';
/* When an AI is generated with 「依個性生成語音」 checked, also create its
   GPT-Live voice (a real Voice ID) right away, so the user does not have
   to open the voice settings afterwards and generate it manually.
   Runs after the release216 wrapper, which handles the stock TTS voice;
   a failure here never undoes the created AI or the stock voice. */
const mzGenerateImportedBase=actions.generateImportedAI;
actions.generateImportedAI=async()=>{
 const id=pendingImportedAI,
  wanted=!!document.querySelector('#importGenerateVoice')?.checked;
 await mzGenerateImportedBase();
 if(!wanted||!id)return;
 if(typeof mzCreateLiveVoiceFor!=='function')return;
 toast('正在生成 GPT-Live 專屬語音…',4000);
 try{
  await mzCreateLiveVoiceFor(id,'');
  render();
  toast('GPT-Live 專屬語音已生成並套用');
 }catch(e){
  toast('GPT-Live 語音生成失敗：'+(e?.message||e)+'（AI 已建立，可之後在音色設定裡再生成）',5000);
 }
};
