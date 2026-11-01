window.MushuiAIOnly=false;window.MIZUKI_SERVER='https://mizukihumanchat.onrender.com';
// Default friend server: the page's own server when the web app is served by one (localhost tests,
// the server's web version); otherwise the official Mizuki server, so nobody has to type it.
window.mizukiDefaultServer=()=>/^https?:$/.test(location.protocol)&&(['localhost','127.0.0.1'].includes(location.hostname)||/\.onrender\.com$/i.test(location.hostname))?location.origin:window.MIZUKI_SERVER;window.DesktopDetached=new URLSearchParams(location.search).get('chat')||'';



