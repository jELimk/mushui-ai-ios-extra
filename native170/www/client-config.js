window.MushuiAIOnly=false;window.MIZUKI_SERVER='https://mizukihumanchat.onrender.com';window.MIZUKI_APP_VERSION='3.1.0';
// Default friend server: the page's own server when the web app is served by one (localhost tests,
// the server's web version); otherwise the official Mizuki server, so nobody has to type it.
window.mizukiDefaultServer=()=>/^https?:$/.test(location.protocol)&&(['localhost','127.0.0.1'].includes(location.hostname)||/\.onrender\.com$/i.test(location.hostname))?location.origin:window.MIZUKI_SERVER;window.DesktopDetached=new URLSearchParams(location.search).get('chat')||'';



// Sign-in hardening: never let a stored or typed friend-server value reach new URL() raw.
// Empty values, non-URLs (an opaque WebView origin can leave the literal string "null" in
// storage), scheme-less hosts, and local/LAN addresses saved on another device all used to
// surface as the browser's English "Failed to construct 'URL': Invalid URL" on phone sign-in.
// Anything that is not a usable https origin falls back to the official server; a local
// address is kept only when this page itself is served from it (local development).
window.mizukiSafeServer=value=>{const fallback=window.MIZUKI_SERVER,raw=String(value==null?'':value).trim();if(!raw)return fallback;let u=null;try{u=new URL(raw);}catch{try{u=new URL('https://'+raw);}catch{}}if(!u||!/^https?:$/.test(u.protocol))return fallback;const host=u.hostname.toLowerCase(),isIp=/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.includes(':'),local=host==='localhost'||host==='::1'||host==='mushui.local'||host.endsWith('.local')||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);if(!local&&!isIp&&!host.includes('.'))return fallback;if(local&&u.origin!==location.origin)return fallback;if(u.protocol!=='https:'&&u.origin!==location.origin)return fallback;return u.origin;};
