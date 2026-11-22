'use strict';
// 3.4.4 賽博朋克: own design (reference repo is non-commercial). Light + dark (follows dark mode), all square, cut-corner
// neon panels, HUD tap, digital (no bounce) motion. No glass. Icons: special-icons / settings-icons 'cyber'.
{
  themes.cyber = { name: '賽博朋克', accent: '#e0006f', deep: '#b0005a', soft: '#e6e2ff', pink: '#ffd6ea', bg: '#eef0ff', bubble: '#ffe3f1', cover: 'linear-gradient(160deg,#e9e6ff,#ffd9ee 55%,#d6f7ff)' };
  const root = document.documentElement;
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const on = () => cur().theme === 'cyber';
  let layer = null;
  const sync = () => {
    const v = on();
    root.classList.toggle('mz-cyber', v);
    if (v) {
      root.classList.remove('mz-glass', 'mz-glass-fx', 'mz-glass-pure', 'mz-cat');
      if (!layer) { layer = document.createElement('div'); layer.id = 'mz-cyber-bg'; layer.innerHTML = '<i class="cy-glow"></i><i class="cy-floor"></i>'; document.body.prepend(layer); }
    }
    if (layer) layer.hidden = !v;
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };
  setTimeout(() => { try { sync(); } catch {} }, 0);
  const cut = (n) => `polygon(0 0,calc(100% - ${n}px) 0,100% ${n}px,100% 100%,${n}px 100%,0 calc(100% - ${n}px))`;
  const R = 'html.mz-cyber:root:root body';
  const css = document.createElement('style');
  css.textContent = `
html.mz-cyber{--cp:#e0006f;--cc:#008fb0;--cv:#6a3cff;--cbg:#eef0ff;--cpanel:#ffffffd9;--cbtn:#ffffff;--cline:#008fb055;--bg:var(--cbg)!important;--ink:#1a1433!important;--muted:#5d5a80!important;--line:#d6d3ef!important;--accent:var(--cp)!important;--accent-deep:#b0005a!important;--soft:#e6e2ff!important;--surface:#fff!important;--glass:var(--cpanel)!important;--mz-duang:steps(5,end)}
html.mz-cyber.mz-dark{--cp:#ff2e88;--cc:#22e4ff;--cv:#8a5cff;--cbg:#0a0918;--cpanel:#120f27d9;--cbtn:#140f2c;--cline:#22e4ff55;--ink:#e9e6ff!important;--muted:#8d88bd!important;--line:#2b2752!important;--accent-deep:#ff8cc2!important;--soft:#1b1436!important;--surface:#120f27!important;color-scheme:dark}
html.mz-cyber body{background:var(--cbg)!important;color:var(--ink)}
html.mz-cyber::before{display:none!important}
#mz-cyber-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}#mz-cyber-bg[hidden]{display:none}
#mz-cyber-bg .cy-glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 85% 8%,color-mix(in srgb,var(--cv) 22%,transparent),transparent 70%),radial-gradient(55% 35% at 8% 30%,color-mix(in srgb,var(--cp) 16%,transparent),transparent 70%),radial-gradient(70% 40% at 50% 100%,color-mix(in srgb,var(--cc) 14%,transparent),transparent 70%)}
#mz-cyber-bg .cy-floor{position:absolute;left:-50%;right:-50%;bottom:0;height:42%;transform:perspective(320px) rotateX(62deg);transform-origin:50% 100%;background:linear-gradient(transparent 0 calc(100% - 1px),color-mix(in srgb,var(--cp) 25%,transparent) 0) 0 0/100% 44px,linear-gradient(90deg,transparent 0 calc(100% - 1px),color-mix(in srgb,var(--cc) 22%,transparent) 0) 0 0/44px 100%;-webkit-mask:linear-gradient(transparent,#000 70%);mask:linear-gradient(transparent,#000 70%)}
#mz-cyber-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(transparent 0 2px,color-mix(in srgb,var(--ink) 3%,transparent) 2px 3px)}

${R} #app{position:relative;z-index:1}
${R} :is(.top,.composer,.card,.chip,.pill,.swatch,.bubble,.switch,.mz-seg,.mz-segs,.sheet,.setting-row,.avatar,.icon-button,.wx-menu-row,.nav){border-radius:0!important}
${R} :is(.card,.chat-entry,.mz-cgroup,.contact-favorites,.wx-menu-group,.search,.setting-choice,.moment,.mz-todo-item,.mz-alarm-item,.wx-profile,.profile-card,.account-connection-notice){background-color:var(--cpanel)!important;border:1px solid var(--cline)!important;clip-path:${cut(12)};box-shadow:none!important}
${R} :is(.card,.chat-entry,.mz-cgroup,.wx-menu-group,.wx-profile,.profile-card){background-image:linear-gradient(var(--cc),var(--cc)),linear-gradient(var(--cc),var(--cc)),linear-gradient(var(--cp),var(--cp)),linear-gradient(var(--cp),var(--cp))!important;background-size:14px 1.5px,1.5px 14px,14px 1.5px,1.5px 14px!important;background-position:0 0,0 0,100% 100%,100% 100%!important;background-repeat:no-repeat!important}
${R} .sheet{background:var(--cbg)!important;border:1px solid var(--cline)!important;clip-path:${cut(18)};box-shadow:none!important}
${R} :is(.top,.composer){background:color-mix(in srgb,var(--cbg) 90%,transparent)!important;border:0!important;border-bottom:1px solid transparent!important;border-image:linear-gradient(90deg,transparent,var(--cp),var(--cv),var(--cc),transparent) 1!important;box-shadow:none!important}
${R} .composer{border-bottom:0!important;border-top:1px solid transparent!important}
${R} h1,${R} h2{text-shadow:0 1px var(--accent)}
${R} .section-label{color:var(--cc)!important}
${R} .pill.primary,${R} .send,${R} [data-action="send"]{background:linear-gradient(90deg,var(--cp),var(--cv))!important;color:#fff!important;border:0!important;clip-path:${cut(8)};box-shadow:none!important}
${R} :is(.pill:not(.primary),.icon-button,.chip,.mz-seg,.chat-menu-button){background:var(--cbtn)!important;border:1px solid var(--cline)!important;clip-path:${cut(7)};color:var(--ink)!important;box-shadow:none!important}
${R} :is(.mz-seg.selected,.chip.selected,.swatch.selected){border-color:var(--cp)!important;color:var(--cp)!important}
${R} :is(.sheet-actions,.flex,.between,.mz-cal-head,.provider-grid,.mz-segs,.mz-al-days,.swatches,.mz-alarm-top,.mz-todo-top){gap:10px!important}
${R} input,${R} textarea,${R} select{background:var(--cbtn)!important;border:1px solid var(--cline)!important;color:var(--ink)!important;caret-color:var(--cp)}
${R} input:focus,${R} textarea:focus{border-color:var(--cp)!important;box-shadow:0 0 0 1px var(--cp)!important;outline:0}
${R} .message .bubble:not(.sticker-only):not(.photo-only){background:var(--cpanel)!important;border:1px solid var(--cline)!important;clip-path:${cut(9)};color:var(--ink)!important;box-shadow:none!important}
${R} .message.mine .bubble:not(.sticker-only):not(.photo-only){background:color-mix(in srgb,var(--cp) 14%,var(--cbtn))!important;border-color:var(--cp)!important}
${R} #app>.nav{background:var(--cbtn)!important;border:1px solid var(--cline)!important;clip-path:${cut(14)};box-shadow:none!important}
${R} #app>.nav button{color:var(--muted)!important}${R} #app>.nav button.active{color:var(--cp)!important}
${R} .desktop-rail{background:var(--cbtn)!important;border-right:1px solid var(--cline)!important}
${R} .avatar,${R} .avatar img{clip-path:${cut(8)}}
${R} :is(.wx-menu-icon,.setting-icon){background:transparent!important;color:var(--cc)!important}
${R} :is(.setting-row,.contact-row,.chat-row,.wx-menu-row):not(:last-child){border-color:var(--line)!important}
${R} #app :is(.moment,.mz-cgroup,.mz-alb-row,.wx-record-row){border-radius:0!important}
${R} #app .chat-entry{padding-inline:8px}
${R} .contact-mode.contact-mode:not(.mz-cm-probe)>button{border-radius:0!important}
${R} .contact-mode::after,${R} .mizuki-record-indicator{background:var(--cp)!important;box-shadow:0 0 6px var(--cp)!important;height:2px!important}
${R} ::selection{background:color-mix(in srgb,var(--cp) 40%,transparent)}
.swatch[data-theme=cyber] span,${R} .swatch[data-theme=cyber] span{background:linear-gradient(transparent 62%,#e0006f66 62% 65%,transparent 65%),linear-gradient(90deg,transparent 30%,#008fb088 30% 34%,transparent 34% 62%,#008fb066 62% 65%,transparent 65%),linear-gradient(160deg,#e9e6ff,#ffd9ee 55%,#d6f7ff)!important;border:1px solid #e0006f!important;border-radius:6px!important}
`;
  document.head.append(css);
}
