'use strict';
// Reorder the existing controls before the settings page is mounted.
{
  const baseAppearance = appearancePage, basePage = settingsPage;
  let apiConnectionOpen = false;
  document.addEventListener('toggle', e => {
    if (e.target.matches?.('.mz-api-connection')) apiConnectionOpen = e.target.open;
  }, true);
  const appearanceRoutes = ['appearance', 'appearanceThemes', 'appearanceBackgrounds', 'appearanceBubbles'];
  Object.assign(pageNames, {
    appearanceThemes: '主題', appearanceBackgrounds: '背景', appearanceBubbles: '主題氣泡框'
  });
  const action = name => `[data-action="${name}"]`;
  const route = name => `[data-page="${name}"]`;
  const toggleFor = name => `[data-toggle="${name}"]`;
  const cardFor = (root, selector) => root.querySelector(selector)?.closest('.card');
  const divider = () => Object.assign(document.createElement('hr'), { className: 'mz-settings-divider' });
  const appendInside = (first, second) => {
    if (!first || !second || first === second) return;
    first.append(divider(), ...second.children);
    second.remove();
  };
  const parsed = html => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template;
  };
  function appearanceContent(current) {
    const template = parsed(baseAppearance());
    const content = template.content;
    const groups = [...content.querySelectorAll('.mz-tg')];
    const backgrounds = [...content.querySelectorAll('[data-imagefield],[data-resetimage],[data-action*="CallBackground"]')]
      .map(button => button.closest('.card')).filter(Boolean);
    for (const card of content.querySelectorAll('.card')) {
      if (card.querySelector('.mz-bg-preview') && !backgrounds.includes(card)) backgrounds.push(card);
    }
    const glass = content.querySelector('.mz-glassfx-card');
    const dark = content.querySelector('.mz-dark-card');
    const chat = cardFor(content, route('chatLook'));
    const font = cardFor(content, action('importFont'));
    const size = cardFor(content, '#textSize');
    if (current === 'appearanceThemes') content.replaceChildren(...groups);
    else if (current === 'appearanceBackgrounds') content.replaceChildren(...new Set(backgrounds));
    else if (current === 'appearanceBubbles') {
      const control = window.mzThemeBubbleControl?.();
      return control ? `<div class="card">${control}</div>` : `<p class="help">${mzT('請先選擇貓咪或海月水母主題。', 'Choose Cat or Moon Jelly first.')}</p>`;
    } else {
      appendInside(font, size);
      const moved = new Set([dark, glass, chat, font, size, ...groups, ...backgrounds]);
      const remaining = [...content.children].filter(e => e.matches('.card') && !moved.has(e));
      content.replaceChildren(...[dark, glass, chat, font, ...remaining].filter(Boolean));
      const links = document.createElement('div');
      links.className = 'card';
      links.innerHTML = settingRow('appearanceThemes', 'palette', mzT('主題', 'Theme'), themes[draft.theme]?.name || '') +
        settingRow('appearanceBubbles', 'chat', mzT('主題氣泡框', 'Theme bubbles'), '') +
        settingRow('appearanceBackgrounds', 'camera', mzT('背景', 'Backgrounds'), '');
      content.append(links);
    }
    return template.innerHTML;
  }
  appearancePage = () => appearanceContent('appearance');
  function organize(content, current) {
    const item = selector => cardFor(content, selector);
    if (current === 'api') {
      const model = content.querySelector('[data-field="model"]');
      const label = model?.previousElementSibling;
      const read = content.querySelector(action('models'));
      const names = content.querySelector('.model-grid');
      const namesLabel = names?.previousElementSibling;
      const provider = content.querySelector('.provider-grid');
      if (model && label?.matches('label') && read) {
        const notes = [...content.querySelectorAll(':scope > .mz-model-note,:scope > .mz-api-note')];
        const help = read.nextElementSibling;
        (provider || names)?.after(label, model, read, ...notes, ...[help].filter(e => e?.matches('p.small')), ...[namesLabel,names].filter(Boolean));
      }
      item(action('mzSafetyTest'))?.classList.add('mz-compact-test');
      const modelLayout = content.querySelector('[data-field="model"]');
      const service = content.querySelector('.provider-grid');
      const intro = service?.previousElementSibling?.previousElementSibling;
      if (intro?.matches('p.help')) intro.remove();
      const url = content.querySelector('#apiUrl');
      const key = content.querySelector('.api-key-row');
      const endpoint = item(toggleFor('customEndpoint'));
      const details = document.createElement('details');
      details.className = 'card mz-api-connection';
      details.open = apiConnectionOpen;
      const summary = document.createElement('summary');
      summary.textContent = mzT('API 連線與金鑰設定', 'API connection and keys');
      details.append(summary);
      for (const node of [service?.previousElementSibling, service, url?.previousElementSibling, url,
        key?.previousElementSibling?.previousElementSibling, key?.previousElementSibling, key,
        content.querySelector('.provider-help'), endpoint]) {
        if (node && node !== modelLayout) details.append(node);
      }
      const test = item(action('mzSafetyTest'));
      test?.before(details);
      modelLayout?.classList.add('mz-model-name');
    } else if (current === 'memory') {
      const count = item('.memory-grid'), other = item(route('individual')), looks = item(toggleFor('keepAppearance'));
      if (count) content.prepend(count);
      appendInside(other, looks);
      const description = other?.querySelector('.toggle-row p');
      if (description) description.textContent = mzT('每次對話與生圖使用固定外貌，獨立於記憶摘要。', 'Keep the same appearance in chats and images, independently of memory.');
      for (const p of [...content.querySelectorAll(':scope > p.help')]) content.append(p);
    } else if (current === 'life') {
      const ongoing = item(action('startLife')) || [...content.querySelectorAll(':scope > .card')].find(e => e.querySelector('.feature-note,.sheet-actions'));
      const main = item(toggleFor('autoMessages'));
      if (ongoing) content.prepend(ongoing);
      if (main) {
        appendInside(main, item(toggleFor('aiMusicControl')));
        appendInside(main, item(toggleFor('showThinking')));
        appendInside(main, item(toggleFor('shareLocation')));
      }
      for (const p of [...content.querySelectorAll(':scope > p.help')]) content.append(p);
    } else if (current === 'chat') {
      const poke = item(action('configurePoke')), camera = item(toggleFor('cameraAutoSaveToLibrary'));
      const format = item(action('formatHelp'));
      for (const p of content.querySelectorAll('p.help,.toggle-row p')) p.remove();
      for (const card of [poke, camera, format]) if (card) content.append(card);

    } else if (current === 'notifications') {
      const notification = item(action('humanBackground')), permissions = item(action('requestUsablePermissions'));
      const precise = item(toggleFor('preciseLocation'));
      const humanBackground = notification?.querySelector(action('humanBackground'));
      if (humanBackground) permissions?.append(divider(), humanBackground);
      notification?.remove();
      precise?.remove();
      const guardian = item(action('mzGuardianPick'));
      const stars = guardian?.previousElementSibling;
      if (stars?.matches('.card')) {
        const header = stars.querySelector('h3'), help = stars.querySelector('p.help');
        if (header) header.textContent = mzT('星星', 'Starred contacts');
        if (help) help.textContent = mzT('將你選擇的裝置事件傳給星標對象。', 'Share selected device events with starred contacts.');
        const guardianHelp = guardian.querySelector('p.help');
        if (guardianHelp) guardianHelp.textContent = mzT('管理員可在 Android 暫時鎖定其它 App。', 'Guardians can temporarily lock other apps on Android.');
        appendInside(stars, guardian);
      }
    } else if (current === 'privacy') {
      const password = item(action('changeAccountPassword'));
      const [emergency, special] = content.querySelectorAll(':scope > .mz-emergency');
      if (emergency && special) {
        for (const p of special.querySelectorAll('.mz-emergency-diff')) p.remove();
        const hints = [...emergency.querySelectorAll(':scope > p.small'), ...special.querySelectorAll(':scope > p.small')];
        appendInside(emergency, special);
        for (const hint of hints) content.append(hint);
      }
      if (password) content.append(password);
      for (const p of [...content.querySelectorAll(':scope > p.help')]) content.append(p);
    } else if (current === 'devices') {
      const browser = content.querySelector('[data-field="browser"],[data-field="preferredBrowser"],[data-browser],#defaultBrowser')?.closest('.card') ||
        [...content.querySelectorAll(':scope > .card')].find(e => e.querySelector('select') && e.querySelector('label')?.textContent.includes('瀏覽器'));
      if (browser) {
        const intro = browser.previousElementSibling;
        if (intro?.matches('p.help')) intro.remove();
        browser.remove();
      }
    }
  }
  const compact = new Set(['api', 'memory', 'life', 'chat', 'notifications', 'privacy', 'devices']);
  settingsPage = function (...args) {
    const current = page;
    if (!compact.has(current) && !appearanceRoutes.includes(current)) return basePage.apply(this, args);
    const template = parsed(basePage.apply(this, args));
    const content = template.content.querySelector('.content');
    if (!content) return template.innerHTML;
    content.classList.add('mz-settings-layout', 'mz-settings-' + current);
    if (appearanceRoutes.slice(1).includes(current)) content.innerHTML = appearanceContent(current);
    else organize(content, current);
    return template.innerHTML;
  };
}
