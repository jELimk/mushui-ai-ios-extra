'use strict';
// 3.4.1: settings save themselves as soon as an option changes, so there is no 儲存 button any more.
//  - switches, choices, colour swatches, sliders: saved a moment after the change;
//  - text boxes: saved when you leave the box (or pause typing for a while), so typing is never interrupted;
//  - leaving the settings page with something unsaved saves it first instead of asking to discard it.
// It uses the same saveSettings() the button used, so keys, checks and syncing all behave the same.
{
  let timer = 0, saving = null, failed = false;
  const typing = () => { const el = document.activeElement; return !!el && el.closest?.('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|range|color)$/.test(el.type || ''); };
  const quietSave = async () => {
    // the button showed 「設定已儲存」 for each press; saving on every change keeps quiet instead
    const realToast = toast;
    toast = (text, ...rest) => { if (text === '設定已儲存' || text === 'Settings saved') return; return realToast(text, ...rest); };
    try { await saveSettings(); } finally { toast = realToast; }
  };
  const flush = async () => {
    clearTimeout(timer); timer = 0;
    if (saving) return saving;
    if (typeof dirty === 'undefined' || !dirty || typeof busy !== 'undefined' && busy) return;
    saving = quietSave().then(() => { failed = false; }, () => { failed = true; }).finally(() => { saving = null; });
    return saving;
  };
  const soon = (ms = 350) => {
    if (typeof tab === 'undefined' || tab !== 'settings') return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (typing()) { soon(1500); return; } flush(); }, ms);
  };
  // any change on a settings page: a click (switch, choice, swatch), a change (select, slider, file), leaving a box
  document.addEventListener('click', (e) => { if (e.target.closest?.('#app,#overlay')) { failed = false; soon(); } }, true);
  document.addEventListener('change', (e) => { if (e.target.closest?.('#app,#overlay')) { failed = false; soon(); } }, true);
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('#app')) soon(200); }, true);
  // while typing: save after a longer pause, once the box is left (typing() keeps it waiting)
  document.addEventListener('input', (e) => { if (e.target.closest?.('#app')) { failed = false; soon(2500); } }, true);
  // leaving the settings: save what's there first, then go
  if (typeof navigate === 'function') {
    const navBefore = navigate;
    navigate = async function (...args) {
      if (typeof dirty !== 'undefined' && dirty && !failed) { document.activeElement?.blur?.(); await flush(); }
      return navBefore.apply(this, args);
    };
  }
  if (typeof window.goBack === 'function') {
    const backBefore = window.goBack;
    window.goBack = function (...args) {
      if (typeof dirty !== 'undefined' && dirty && !failed && tab === 'settings') { document.activeElement?.blur?.(); flush().finally(() => backBefore.apply(this, args)); return true; }
      return backBefore.apply(this, args);
    };
  }
  // no 儲存 button on the settings pages (the profile page's too)
  const css = document.createElement('style');
  css.textContent = '#app .page>.top [data-action="save"]{display:none!important}';
  document.head.append(css);
  window.mzSettingsAutosave = { flush, schedule: soon };
  // 3.4.4: no Save button any more → drop every "tap Save" hint (toasts and help lines); a toast that was only that is skipped
  const SAVE = /[；;，,。]?\s*(請|再)?(按|點)(右上角)?(「)?儲存(」)?(後|才)?(才)?(生效|保留)?[。！]?|[；;，,]?\s*回到設定按儲存才生效[。]?|[;,.]?\s*tap Save( to keep them)?\.?/g;
  const clean = (t) => String(t).replace(SAVE, '').trim();
  if (typeof toast === 'function') { const t0 = toast; toast = function (m, ...r) { if (typeof m === 'string' && SAVE.test(m)) { SAVE.lastIndex = 0; m = clean(m); if (!m) return; } SAVE.lastIndex = 0; return t0.call(this, m, ...r); }; }
  const done = new WeakSet(); let queued = false;
  const tidy0 = () => document.querySelectorAll('#app .help, #overlay .help').forEach((p) => { if (done.has(p)) return; done.add(p); if (/儲存|Save/.test(p.textContent)) { const c = clean(p.textContent); SAVE.lastIndex = 0; if (c !== p.textContent.trim()) { if (c) p.textContent = c; else p.remove(); } } });
  const tidy = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; try { tidy0(); } catch {} }, 50); };
  try { new MutationObserver(tidy).observe(document.body, { childList: true, subtree: true }); } catch {}
}

// Save fields independently so changing one setting cannot overwrite a concurrent synced edit.
let mzSheetSave = Promise.resolve();
function mzQueueSheetSave(save, sheet = modal) {
 const result = mzSheetSave.then(save).catch(error => {
  if (sheet && modal === sheet) modalError(error);
  else toast(error.message);
 });
 mzSheetSave = result;
 return result;
}
function mzSaveSheetField(id, field, value) {
 return mzQueueSheetSave(async () => {
  await mutate('contact', {id, [field]:value});
  render();
 });
}
{
 const fields = {contactName:'name',contactPersonality:'personality',contactCategory:'category',contactFavorite:'favorite',contactSpecialStar:'specialStar'};
 const voice = {voiceUrl:'url',voiceModel:'model',voiceKey:'key'};
 const pending = new Map();
 const composing = new WeakSet();
 const saved = new WeakMap();
 function schedule(input, immediate = false) {
  const id=input.id, field=fields[id], speech=voice[id], contact=modal?.aiId, friend=window.pendingContactNoteId;
  if (!input.closest('#overlay') || !(field && contact || speech || id === 'contactNote' && friend)) return;
  clearTimeout(pending.get(input)?.timer);
  pending.delete(input);
  const isCheck=input.type==='checkbox', value=isCheck?input.checked:input.value.trim();
  if (saved.get(input)===value || (!value && ['name','personality','url','model','key'].includes(field||speech))) return;
  const sheet=modal;
  const commit=()=>{
   pending.delete(input);
   if (saved.get(input)===value) return;
   saved.set(input,value);
   void mzQueueSheetSave(async ()=>{
    try {
     if (field) await mutate('contact',{id:contact,[field]:value});
     else if (speech) state=(await call('voiceConfig',{[speech]:value})).state;
     else {
      await WebEngine.setFriendPref('note',friend,value);
      state=await WebEngine.view();
     }
     if (speech==='key' && input.value.trim()===value) {
      input.value='';
      input.placeholder=mzT('已保存；留白保留','Saved; leave blank to keep');
      saved.delete(input);
     }
     if (!speech) render();
    } catch(error) {
     if (saved.get(input)===value) saved.delete(input);
     throw error;
    }
   },sheet);
  };
  if (immediate) commit(); else pending.set(input,{timer:setTimeout(commit,450),commit});
 }
 document.addEventListener('compositionstart',e=>composing.add(e.target));
 document.addEventListener('compositionend',e=>{composing.delete(e.target);schedule(e.target);});
 document.addEventListener('input',e=>{if (!e.isComposing&&!composing.has(e.target)&&e.target.type!=='password') schedule(e.target,e.target.type==='checkbox');});
 document.addEventListener('change',e=>{if (!composing.has(e.target)) schedule(e.target,true);});
 const close=closeModal;
 closeModal=function(...args){
  const focused=document.activeElement;
  if (!composing.has(focused)&&focused?.type==='password'&&focused.id==='voiceKey'&&focused.value) schedule(focused,true);
  for (const {timer,commit} of pending.values()){clearTimeout(timer);commit();}
  return close.apply(this,args);
 };
}
