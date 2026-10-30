'use strict';
// Keep the original select and its value/change handlers. Only replace its UI.
(()=>{
 const controls=new WeakMap();let picker=null,sequence=0;
 const svg=name=>typeof icon==='function'?icon(name):'';
 function labelFor(select){return select.labels?.[0]?.textContent.trim()||(select.previousElementSibling?.tagName==='LABEL'?select.previousElementSibling.textContent.trim():'')||select.getAttribute('aria-label')||select.title||'選擇選項';}
 function sync(select){
  const button=controls.get(select);if(!button)return;
  button.disabled=select.disabled;
  button.querySelector('.choice-label').textContent=select.selectedOptions[0]?.textContent||'選擇選項';
  button.setAttribute('aria-label',labelFor(select)+'：'+button.textContent.trim());
 }
 function range(input){const min=Number(input.min||0),max=Number(input.max||100),value=Number(input.value);input.style.setProperty('--range-progress',Math.max(0,Math.min(100,(value-min)/(max-min||1)*100))+'%');}
 function enhance(root){
  if(root.nodeType!==1&&root.nodeType!==9)return;
  const selects=[...(root.matches?.('select')?[root]:[]),...root.querySelectorAll('select')];
  for(const select of selects){
   if(select.multiple||select.size>1)continue;
   if(!controls.has(select)){
    const button=document.createElement('button');button.type='button';button.className='macaron-select';
    button.innerHTML='<span class="choice-label"></span>'+svg('back');
    const arrow=button.querySelector('svg');if(arrow)arrow.style.transform='rotate(-90deg)';
    button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    controls.set(select,button);select.after(button);
    button.addEventListener('click',()=>open(select,button));
    select.addEventListener('change',()=>sync(select));
    select.addEventListener('focus',()=>button.focus());
   }
   sync(select);
  }
  for(const input of [...(root.matches?.('input[type=range]')?[root]:[]),...root.querySelectorAll('input[type=range]')])range(input);
 }
 function close(focus=true){if(!picker)return;const p=picker;picker=null;p.node.remove();p.button.setAttribute('aria-expanded','false');document.removeEventListener('keydown',p.keydown,true);if(focus&&p.button.isConnected)p.button.focus({preventScroll:true});}
 function open(select,button){
  if(select.disabled)return;close(false);
  const node=document.createElement('div');node.className='macaron-picker-backdrop';
  const title='macaron-choice-'+(++sequence);
  node.innerHTML='<section class="macaron-picker" role="dialog" aria-modal="true" aria-labelledby="'+title+'"><header class="macaron-picker-header"><h2 id="'+title+'"></h2><button type="button" aria-label="關閉選單">'+svg('close')+'</button></header><div class="macaron-options" role="listbox" tabindex="-1" aria-labelledby="'+title+'"></div></section>';
  node.querySelector('h2').textContent=labelFor(select);
  const list=node.querySelector('[role=listbox]');let lastGroup=null;
  for(const option of select.options){
   if(option.hidden)continue;
   const group=option.parentElement.tagName==='OPTGROUP'?option.parentElement:null;
   if(group&&group!==lastGroup){const heading=document.createElement('div');heading.className='macaron-option-group';heading.textContent=group.label;list.append(heading);}lastGroup=group;
   const item=document.createElement('div'),disabled=option.disabled||!!group?.disabled;
   item.className='macaron-option';item.tabIndex=-1;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.setAttribute('aria-disabled',String(disabled));
   const text=document.createElement('span');text.className='option-label';text.textContent=option.textContent;item.append(text);if(option.selected)item.insertAdjacentHTML('beforeend',svg('check'));
   if(!disabled){item.addEventListener('click',()=>{select.selectedIndex=option.index;sync(select);close();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));});}
   list.append(item);
  }
  const options=[...list.querySelectorAll('[aria-disabled=false]')];
  function focus(index){if(options.length)options[(index+options.length)%options.length].focus({preventScroll:true});document.activeElement?.scrollIntoView({block:'nearest'});}
  const keydown=e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
   const index=options.indexOf(document.activeElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();focus(e.key==='Home'?0:e.key==='End'?options.length-1:index+(e.key==='ArrowDown'?1:-1));}
   if((e.key==='Enter'||e.key===' ')&&index>=0){e.preventDefault();e.stopImmediatePropagation();options[index].click();}
   if(e.key==='Tab'){e.preventDefault();const targets=[node.querySelector('button'),...options];const i=targets.indexOf(document.activeElement);targets[(i+(e.shiftKey?-1:1)+targets.length)%targets.length]?.focus();}
  };
  picker={node,button,select,keydown};button.setAttribute('aria-expanded','true');
  node.querySelector('button').onclick=()=>close();node.addEventListener('click',e=>{if(e.target===node)close();});
  document.body.append(node);document.addEventListener('keydown',keydown,true);
  const selected=options.findIndex(x=>x.getAttribute('aria-selected')==='true');focus(Math.max(0,selected));
 }
 document.addEventListener('input',e=>{if(e.target.matches('input[type=range]'))range(e.target);});
 const observer=new MutationObserver(records=>{
  for(const r of records){
   if(r.type==='attributes'){if(r.target.matches('select'))sync(r.target);if(r.target.matches('input[type=range]'))range(r.target);continue;}
   if(r.target.closest?.('select'))sync(r.target.closest('select'));
   for(const node of r.addedNodes)enhance(node);
  }
  if(picker&&!picker.select.isConnected)close(false);
 });
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','min','max','value']});
 enhance(document);window.MushuiThemeControls={refresh:()=>enhance(document),close};
})();
