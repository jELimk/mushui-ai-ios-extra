'use strict';
// 3.4.1: the day / night lens switch, now the face of the 玻璃效果 (glass UI) switch in Appearance. A capsule "window"
// shows a small room; a round glass lens magnifies what is under it. Glass on = day (lens on the right), glass off =
// night (lens on the left). Tap it, or drag the lens across. Liquid Glass and Moon Jelly are always glass (locked on).
// Dark mode keeps its own three buttons (follow system / light / dark) again.
{
  const W = 300, CY = 65, R = 44, DAY_X = 234, NIGHT_X = 66, ZOOM = 1.45;
  const isDark = () => !document.documentElement.classList.contains('mz-glass'); // "night" = glass off
  // the room, drawn twice (once normally, once magnified inside the lens); .d = day only, .n = night only
  const room = () => `
<rect x="0" y="0" width="${W}" height="130" class="d" fill="#eef0f7"/><rect x="0" y="0" width="${W}" height="130" class="n" fill="#20254a"/>
<rect x="0" y="100" width="${W}" height="30" class="d" fill="#cfd5e6"/><rect x="0" y="100" width="${W}" height="30" class="n" fill="#161a36"/>
<g>
 <rect x="30" y="22" width="74" height="70" rx="6" class="d" fill="url(#mzdnSky)"/>
 <rect x="30" y="22" width="74" height="70" rx="6" class="n" fill="#101536"/>
 <g class="d"><circle cx="86" cy="38" r="8" fill="#ffd66b"/><ellipse cx="52" cy="46" rx="13" ry="5" fill="#fff"/><ellipse cx="60" cy="43" rx="8" ry="5" fill="#fff"/><ellipse cx="78" cy="62" rx="10" ry="4" fill="#ffffffd0"/></g>
 <g class="n"><path d="M89 32a8 8 0 1 0 6 12a6.5 6.5 0 1 1-6-12z" fill="#ffe9a8"/>
  <circle cx="42" cy="31" r="1" fill="#fff"/><circle cx="58" cy="28" r="1.2" fill="#fff"/><circle cx="70" cy="38" r=".9" fill="#fff"/><circle cx="48" cy="44" r=".8" fill="#fff"/><circle cx="76" cy="27" r=".8" fill="#fff"/></g>
 <g fill="#9aa6c8" class="d"><rect x="34" y="66" width="12" height="26"/><rect x="48" y="58" width="10" height="34"/><rect x="60" y="70" width="14" height="22"/><rect x="76" y="62" width="9" height="30"/><rect x="87" y="72" width="13" height="20"/></g>
 <g class="n"><g fill="#2c3366"><rect x="34" y="66" width="12" height="26"/><rect x="48" y="58" width="10" height="34"/><rect x="60" y="70" width="14" height="22"/><rect x="76" y="62" width="9" height="30"/><rect x="87" y="72" width="13" height="20"/></g>
  <g fill="#ffd27a"><rect x="37" y="70" width="2" height="2"/><rect x="41" y="76" width="2" height="2"/><rect x="51" y="62" width="2" height="2"/><rect x="51" y="70" width="2" height="2"/><rect x="64" y="74" width="2" height="2"/><rect x="69" y="80" width="2" height="2"/><rect x="79" y="66" width="2" height="2"/><rect x="90" y="76" width="2" height="2"/><rect x="95" y="82" width="2" height="2"/></g></g>
 <rect x="30" y="22" width="74" height="70" rx="6" fill="none" stroke="#fff" stroke-width="3" class="d"/><rect x="30" y="22" width="74" height="70" rx="6" fill="none" stroke="#3a4170" stroke-width="3" class="n"/>
 <path d="M67 22v70M30 57h74" stroke="#fff" stroke-width="2" class="d"/><path d="M67 22v70M30 57h74" stroke="#3a4170" stroke-width="2" class="n"/>
</g>
<ellipse class="n" cx="196" cy="70" rx="58" ry="34" fill="url(#mzdnGlow)"/>
<g>
 <rect x="134" y="76" width="102" height="5" rx="2" class="d" fill="#8d96b5"/><rect x="134" y="76" width="102" height="5" rx="2" class="n" fill="#4a5186"/>
 <path d="M140 81v20M230 81v20" stroke-width="3" class="d" stroke="#8d96b5"/><path d="M140 81v20M230 81v20" stroke-width="3" class="n" stroke="#4a5186"/>
 <rect x="158" y="48" width="42" height="26" rx="3" class="d" fill="#5b6488"/><rect x="158" y="48" width="42" height="26" rx="3" class="n" fill="#2e3566"/>
 <rect x="161" y="51" width="36" height="20" rx="1.5" class="d" fill="#dfe8ff"/><rect x="161" y="51" width="36" height="20" rx="1.5" class="n" fill="#7fa6ff"/>
 <g stroke-width="2" stroke-linecap="round"><path d="M165 56h14M165 61h22M165 66h10" class="d" stroke="#9fb3e6"/><path d="M165 56h14M165 61h22M165 66h10" class="n" stroke="#e6eeff"/></g>
 <path d="M176 74h6v2h-6z" fill="#5b6488"/>
 <path d="M220 58c0-5 5-10 5-10s5 5 5 10a5 5 0 0 1-10 0z" class="d" fill="#a99ad6"/><path d="M220 58c0-5 5-10 5-10s5 5 5 10a5 5 0 0 1-10 0z" class="n" fill="#ffd27a"/>
 <path d="M225 63v13M219 76h12" stroke="#7d86a8" stroke-width="2"/>
 <circle class="n" cx="225" cy="58" r="12" fill="#ffd27a33"/>
</g>
<g>
 <rect x="248" y="28" width="34" height="4" rx="1" fill="#9aa3c2"/><rect x="248" y="52" width="34" height="4" rx="1" fill="#9aa3c2"/>
 <rect x="251" y="40" width="5" height="12" fill="#e98fb0"/><rect x="257" y="38" width="5" height="14" fill="#8fb6e9"/><rect x="263" y="42" width="5" height="10" fill="#9ad6b8"/><rect x="270" y="39" width="4" height="13" fill="#f2c46d"/>
 <path d="M262 28c-4-8 2-12 2-12s6 4 2 12z" fill="#7cc49a"/><path d="M264 28c2-7 9-8 9-8s-1 7-9 8z" fill="#5eae82"/><rect x="259" y="24" width="10" height="5" rx="1" fill="#c99b7a"/>
 <rect class="n" x="246" y="26" width="38" height="32" fill="#0b0f2a66"/>
</g>
<g>
 <ellipse cx="262" cy="102" rx="16" ry="4" fill="#00000018"/>
 <path d="M249 100c0-9 8-14 15-13 8 1 12 7 11 13z" class="d" fill="#f4f1f8" stroke="#b8b0cc" stroke-width="1.5"/>
 <path d="M249 100c0-9 8-14 15-13 8 1 12 7 11 13z" class="n" fill="#8f88b0" stroke="#5c5785" stroke-width="1.5"/>
 <path d="M253 90l2-5 3 4M268 88l3-4 1 5" class="d" fill="#f4f1f8" stroke="#b8b0cc" stroke-width="1.5" stroke-linejoin="round"/>
 <path d="M253 90l2-5 3 4M268 88l3-4 1 5" class="n" fill="#8f88b0" stroke="#5c5785" stroke-width="1.5" stroke-linejoin="round"/>
 <path d="M258 94q2 1.5 4 0M265 94q2 1.5 4 0" stroke="#6b6585" stroke-width="1.2" fill="none" stroke-linecap="round"/>
</g>
<rect class="n" x="0" y="0" width="${W}" height="130" fill="#0a0d2a30"/>`;
  const svg = (dark) => {
    const x = dark ? NIGHT_X : DAY_X;
    return `<button type="button" class="mz-dn ${dark ? 'night' : ''}" role="switch" aria-checked="${!dark}" aria-label="${mzT('玻璃效果', 'Glass effect')}" ${window.mzGlassLocked?.() ? 'data-locked="1"' : ''}>
<svg viewBox="0 0 ${W} 130" aria-hidden="true">
<defs>
 <linearGradient id="mzdnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd4ff"/><stop offset="1" stop-color="#e6f5ff"/></linearGradient>
 <radialGradient id="mzdnGlow"><stop offset="0" stop-color="#ffcf74" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf74" stop-opacity="0"/></radialGradient>
 <linearGradient id="mzdnBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mz-dn-b1"/><stop offset="1" class="mz-dn-b2"/></linearGradient>
 <radialGradient id="mzdnGlass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#9fb4ff" stop-opacity=".18"/></radialGradient>
 <clipPath id="mzdnWin"><rect x="12" y="12" width="${W - 24}" height="106" rx="53"/></clipPath>
 <clipPath id="mzdnLens"><circle id="mzdnLensC" cx="${x}" cy="${CY}" r="${R}"/></clipPath>
</defs>
<rect x="2" y="2" width="${W - 4}" height="126" rx="63" fill="url(#mzdnBezel)"/>
<rect x="9" y="9" width="${W - 18}" height="112" rx="56" class="mz-dn-inset"/>
<g clip-path="url(#mzdnWin)">${room()}
 <g clip-path="url(#mzdnLens)"><g class="mz-dn-zoom" transform="${zoomT(x)}">${room()}</g></g>
 <g class="mz-dn-lens" transform="translate(${x} ${CY})">
  <circle r="${R}" fill="url(#mzdnGlass)"/>
  <circle r="${R - 1.5}" fill="none" stroke="#ffffffcc" stroke-width="3"/>
  <circle r="${R + 1.5}" fill="none" stroke="#00000030" stroke-width="2"/>
  <path d="M${-R * 0.62} ${-R * 0.5}A${R * 0.8} ${R * 0.8} 0 0 1 ${-R * 0.05} ${-R * 0.8}" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".85"/>
  <circle cx="${R * 0.42}" cy="${R * 0.5}" r="3" fill="#fff" opacity=".5"/>
 </g>
</g>
<rect x="12" y="12" width="${W - 24}" height="106" rx="53" fill="none" class="mz-dn-edge"/>
</svg></button>`;
  };
  function zoomT(x) { return `translate(${x} ${CY}) scale(${ZOOM}) translate(${-x} ${-CY})`; }
  const parts = new WeakMap();
  const place = (btn, x) => {
    let el = parts.get(btn);
    if (!el) {
      el = [btn.querySelector('.mz-dn-lens'),btn.querySelector('.mz-dn-zoom'),btn.querySelector('#mzdnLensC')];
      parts.set(btn,el);
    }
    el[0]?.setAttribute('transform', `translate(${x} ${CY})`);
    el[1]?.setAttribute('transform', zoomT(x));
    el[2]?.setAttribute('cx', x);
    btn._x = x;
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let modeRequest = 0;
  const slide = (btn, dark, commit = false) => {
    const request = commit ? ++modeRequest : modeRequest, theme = draft?.theme;
    cancelAnimationFrame(btn._raf);
    const from = btn._x ?? (isDark() ? NIGHT_X : DAY_X), to = dark ? NIGHT_X : DAY_X;
    const start = performance.now(), ms = reduced() ? 0 : 360;
    btn._committing = commit;
    btn.classList.toggle('night', dark);
    btn.setAttribute('aria-checked', String(!dark));
    const frame = (now) => {
      if (request !== modeRequest || (!btn.isConnected && !commit)) return;
      const p = ms ? Math.min(1,(now-start)/ms) : 1;
      if (btn.isConnected) place(btn,from+(to-from)*(1-Math.pow(1-p,3)));
      if(p<1)btn._raf=requestAnimationFrame(frame);
      else {
        btn._committing=false;
        if(commit && tab==='settings' && page==='appearance' && draft?.theme===theme && dark!==isDark())window.mzSetGlassFx?.(!dark);
      }
    };
    btn._raf=requestAnimationFrame(frame);
  };
  let drag = null;
  const dragTo = (d,x) => Math.max(NIGHT_X,Math.min(DAY_X,d.from+(x-d.start)*d.scale));
  document.addEventListener('pointerdown', (e) => {
    const btn=e.target.closest?.('.mz-dn');
    if(!btn||e.button!==0)return;
    ++modeRequest;
    cancelAnimationFrame(btn._raf);
    drag={btn,id:e.pointerId,start:e.clientX,from:btn._x??(isDark()?NIGHT_X:DAY_X),scale:W/btn.getBoundingClientRect().width,frame:0,x:null};
    try{btn.setPointerCapture(e.pointerId);}catch{}
  });
  document.addEventListener('pointermove', (e) => {
    const d=drag;
    if(!d||e.pointerId!==d.id||d.x===null&&Math.abs(e.clientX-d.start)<6)return;
    d.x=dragTo(d,e.clientX);
    if(!d.frame)d.frame=requestAnimationFrame(()=>{d.frame=0;place(d.btn,d.x);});
    if(e.cancelable)e.preventDefault();
  },{passive:false});
  const end = (e) => {
    const d=drag;
    if(!d||e.pointerId!==d.id)return;
    drag=null;
    cancelAnimationFrame(d.frame);
    if(d.x!==null)place(d.btn,d.x);
    const cancelled=e.type==='pointercancel';
    // 3.4.4: a locked switch (theme can't / always has glass) still drags, then springs back by itself
    const locked=d.btn.dataset.locked==='1';
    const dark=cancelled||locked?isDark():d.x!==null?d.x<(DAY_X+NIGHT_X)/2:!d.btn.classList.contains('night');
    d.btn._skipClick=!cancelled;
    slide(d.btn,dark,!cancelled&&!locked);
  };
  document.addEventListener('pointerup',end);
  document.addEventListener('pointercancel',end);
  document.addEventListener('click',(e)=>{
    const btn=e.target.closest?.('.mz-dn');
    if(!btn)return;
    if(btn.dataset.locked==='1'){btn._skipClick=false;return;}
    if(btn._skipClick&&e.detail!==0){btn._skipClick=false;return;}
    btn._skipClick=false;
    slide(btn,!btn.classList.contains('night'),true);
  });
  // follow the real mode (the three buttons, "follow system", other devices)
  try {
    new MutationObserver(() => { const dark = isDark(); document.querySelectorAll('.mz-dn').forEach((b) => { if (b.classList.contains('night') !== dark && !drag && !b._committing) slide(b, dark); }); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  } catch {}
  const before = appearancePage;
  appearancePage = function (...a) {
    const html = before.apply(this, a);
    // the lens takes the place of the glass-effect card's plain switch
    return html.replace(/(<div class="card mz-glassfx-card">[\s\S]*?)<button class="switch[^"]*" type="button" data-mzglassfx[^>]*><\/button>/, (_, head) => head.replace('<div class="toggle-row">', '<div class="toggle-row mz-dn-row">') + svg(isDark()));
  };
  const css = document.createElement('style');
  css.textContent = `.mz-dn-row{flex-direction:column;align-items:stretch!important}
.mz-dn[data-locked]{opacity:.85}
.mz-dn{display:block;width:min(100%,300px);margin:12px auto 4px;padding:0;border:0;background:none;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 10px 18px #2a2f5a33)}
.mz-dn svg{display:block;width:100%;height:auto;overflow:visible}
.mz-dn .d,.mz-dn .n{transition:opacity .55s ease}
.mz-dn .n{opacity:0}.mz-dn.night .n{opacity:1}.mz-dn.night .d{opacity:0}
.mz-dn-b1{stop-color:#fdfdff;transition:stop-color .55s}.mz-dn-b2{stop-color:#b9bdcc;transition:stop-color .55s}
.mz-dn.night .mz-dn-b1{stop-color:#4a5088}.mz-dn.night .mz-dn-b2{stop-color:#11142e}
.mz-dn-inset{fill:#00000010;stroke:#ffffffb0;stroke-width:1.5;transition:stroke .55s}
.mz-dn.night .mz-dn-inset{fill:#0000;stroke:#8f9bff40}
.mz-dn-edge{stroke:#0000002a;stroke-width:2}
.mz-dn.night{filter:drop-shadow(0 0 22px #ffcf7433) drop-shadow(0 10px 18px #0006)}
.mz-dn:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:70px}`;
  document.head.append(css);
}
