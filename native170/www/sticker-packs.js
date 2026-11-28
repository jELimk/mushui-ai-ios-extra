'use strict';
// 3.4.1: built-in stickers come in named packs. 沐水卡哇-1 is the original set (stickers/jelee): the 41 still ones
// first, the 8 moving ones at the bottom. A new pack later (沐水卡哇-2…) gets its own folder and ids, an entry in
// PACKS, and its own chip in the sticker panel. Sticker ids stay the same, so old messages still show their sticker.
{
  const PACKS = [
    { id: 'kawa-1', name: '沐水卡哇-1', has: (s) => s.type === 'png' },
    { id: 'waka-1', name: '沐水哇卡-1', has: (s) => s.type === 'gif' },
    { id: 'kawa-2', name: '沐水卡哇-2', has: () => false },
  ];
  for (const s of stickerCatalog) s.pack = s.pack || PACKS.find((p) => p.has(s))?.id;
  const order = { png: 0, gif: 1 };
  const list = (pack) => stickerCatalog.filter((s) => s.pack === pack).sort((a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2));
  window.mzStickerTile = (s) => {
    const thumb = s.asset.replace(/\.(?:png|gif)$/, '.thumb.webp');
    return `<button data-selectsticker="${esc(s.id)}" aria-label="${esc(s.name)}"><img src="${esc(thumb)}" alt="" width="56" height="56" loading="lazy" decoding="async"><span>${esc(s.name)}</span></button>`;
  };
  const tabs = [{id:'mine', name:'我的表情包'}, ...PACKS];
  const current = () => tabs.some(p => p.id === stickerFilter) ? stickerFilter : (stickerFilter = 'mine');
  const customGrid = () => {
    const custom = state.settings.customStickers || [];
    return `<section class="mizuki-my-stickers"><h3 class="custom-sticker-heading">${mzT('我的表情包', 'My stickers')} <small>${custom.length}/${MIZUKI_STICKER_LIMIT}</small></h3><div class="sticker-grid custom-sticker-grid"><button type="button" class="mizuki-sticker-add" data-action="addCustomSticker" aria-label="${mzT('新增表情包','Add sticker')}"><span class="custom-sticker-add">＋</span></button>${custom.map(s => `<button type="button" data-send-custom-sticker="${esc(s.id)}" aria-label="${esc(s.name)}"><img src="${esc(s.data)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div></section>`;
  };

  const before = syncComposerPanel;
  syncComposerPanel = function (...a) {
    const r = before.apply(this, a);
    const panel = document.querySelector('.sticker-panel');
    if (!panel) return r;
    const pack = current();
    const grid = panel.querySelector('.sticker-grid:not(.custom-sticker-grid)');
    if (grid?.dataset.pack === pack) return r;
    const chips = panel.querySelector('.between .flex');
    if (chips) chips.innerHTML = tabs.map((p) => `<button class="chip ${p.id === pack ? 'selected' : ''}" data-stickerfilter="${p.id}">${mzT(p.name, p.id === 'mine' ? 'My stickers' : p.name.replace('沐水卡哇', 'Mushui Kawa').replace('沐水哇卡', 'Mushui Waka'))}</button>`).join('');
    panel.querySelector('.mizuki-my-stickers')?.remove();
    if (grid) {
      grid.dataset.pack = pack;
      grid.hidden = pack === 'mine';
      grid.innerHTML = pack === 'mine' ? '' : list(pack).map(window.mzStickerTile).join('');
      if (pack === 'mine') grid.insertAdjacentHTML('beforebegin', customGrid());
    }
    return r;
  };
  window.mzStickerPacks = { PACKS, list };
}
