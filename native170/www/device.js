window.DesktopUIReady=!window.MushuiDesktop;

if(window.MushuiDesktop){(async()=>{for(const name of ['desktop.js','desktop-layout.js','desktop-controls.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=name;s.onload=resolve;s.onerror=reject;document.body.append(s);});window.DesktopUIReady=true;window.dispatchEvent(new Event('mushui-desktop-modules-ready'));window.installStableChat?.();})().catch(console.error);}
// 3.4.4: big touch screens (iPad, unfolded iPhone Duo, tablets) get the split view; loaded the first time the screen is ≥900 wide.
else{const mzSplit=()=>{if(innerWidth<900||window.mzSplitLoaded)return;window.mzSplitLoaded=true;if(typeof detachTools==='undefined')window.detachTools=()=>{};const s=document.createElement('script');s.src='desktop-layout.js';document.body.append(s);};mzSplit();addEventListener('resize',mzSplit);}

