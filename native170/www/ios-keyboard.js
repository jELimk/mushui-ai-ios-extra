'use strict';
if(window.IOSHost){
 const root=document.documentElement,body=document.body;body.classList.add('native-ios');let scheduled=false;
 function sync(){scheduled=false;const v=window.visualViewport;root.style.setProperty('--app-height',Math.round(v?.height||window.innerHeight)+'px');root.style.setProperty('--viewport-top',Math.max(0,Math.round(v?.offsetTop||0))+'px');if(window.scrollY||root.scrollTop||body.scrollTop)window.scrollTo(0,0);}
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync);}
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});window.visualViewport?.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]')){body.classList.add('keyboard-open');schedule();setTimeout(schedule,80);setTimeout(schedule,260);}},true);
 document.addEventListener('focusout',e=>{if(e.target.matches('input,textarea,[contenteditable="true"]'))setTimeout(()=>{if(!document.activeElement?.matches('input,textarea,[contenteditable="true"]'))body.classList.remove('keyboard-open');schedule();},120);},true);sync();
 // 3.2.1: the keyboard's Done bar is gone (LocalApp.swift), so a tap outside the field closes the keyboard.
 let tapX=0,tapY=0;document.addEventListener('touchstart',e=>{const t=e.touches[0];if(t){tapX=t.clientX;tapY=t.clientY;}},{passive:true,capture:true});
 document.addEventListener('touchend',e=>{const a=document.activeElement,t=e.changedTouches[0];if(!t||!body.classList.contains('keyboard-open')||!a?.matches('input,textarea,[contenteditable="true"]'))return;if(Math.abs(t.clientX-tapX)>10||Math.abs(t.clientY-tapY)>10)return;if(e.target.closest?.('input,textarea,select,button,a,label,[data-action],.composer,.sheet,.modal-backdrop'))return;a.blur();},{passive:true,capture:true});
}
