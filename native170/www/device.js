window.DesktopUIReady=!window.MushuiDesktop;
if(window.MushuiDesktop){(async()=>{for(const name of ['desktop.js','desktop-layout.js','desktop-controls.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=name;s.onload=resolve;s.onerror=reject;document.body.append(s);});window.DesktopUIReady=true;window.installStableChat?.();})().catch(console.error);}
