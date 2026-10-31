'use strict';
if(window.IOSHost){
 const root=document.documentElement,body=document.body;body.classList.add('native-ios');let scheduled=false;
 function sync(){scheduled=false;const v=window.visualViewport;root.style.setProperty('--app-height',Math.round(v?.height||window.innerHeight)+'px');root.style.setProperty('--viewport-top',Math.max(0,Math.round(v?.offsetTop||0))+'px');if(window.scrollY||root.scrollTop||body.scrollTop)window.scrollTo(0,0);}
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync);}
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});window.visualViewport?.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]')){body.classList.add('keyboard-open');schedule();setTimeout(schedule,80);setTimeout(schedule,260);}},true);
 document.addEventListener('focusout',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]'))setTimeout(()=>{if(!document.activeElement?.matches('input,textarea,[contenteditable="true"]'))body.classList.remove('keyboard-open');schedule();},120);},true);sync();
}
