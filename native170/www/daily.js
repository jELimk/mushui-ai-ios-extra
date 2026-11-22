'use strict';
// Me → Daily, mood selection and device-local weather.
{
  const lineIcon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const dailyIcon = 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5';
  const weatherIcon = 'M5 17a3 3 0 0 1-1-5.8 4.8 4.8 0 0 1 9-.8A3.5 3.5 0 1 1 17 17z M15 5l1-2 M19 7l2-1';
  const row = (attribute, title, en, path) => `<button class="wx-menu-row" ${attribute}><span class="wx-menu-icon color">${lineIcon(path)}</span><b>${mzT(title,en)}</b><span class="spacer"></span><span class="chevron">›</span></button>`;
  Object.assign(pageNames, { daily: '日常' });
  const settingsBeforeDaily = settingsPage;
  settingsPage = function (...args) {
    if (page !== 'daily') return settingsBeforeDaily.apply(this, args);
    return `<header class="top"><div class="between"><div class="flex">${btn('back','back','返回')}<h2>${mzT('日常','Daily')}</h2></div></div></header>
      <div class="content"><div class="wx-menu-group mz-daily-menu">
      ${row('data-page="records"', '記錄', 'Records', dailyIcon)}
      ${row('data-action="mzTodo"', '待辦與行事曆', 'To-do & calendar', 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14l2 2 5-4')}
      ${row('data-action="mzAlarm"', '鬧鐘', 'Alarms', 'M12 7v5l3 2 M12 4a8 8 0 1 0 .01 0z M4 4l3-2 M20 4l-3-2')}
      ${row('data-action="mzWeather"', '天氣', 'Weather', weatherIcon)}</div></div>`;
  };

  const moods = {
    joyful: ['愉悅', 'Joyful', 'M8 14q4 5 8 0 M8 9h.1 M16 9h.1'],
    tired: ['疲憊', 'Tired', 'M7 10h3 M14 10h3 M10 16h4'],
    low: ['低落', 'Low', 'M8 16q4-5 8 0 M8 9h.1 M16 9h.1'],
    angry: ['生氣', 'Angry', 'M7 8l3 2 M17 8l-3 2 M9 16q3-3 6 0'],
    custom: ['自定義', 'Custom', 'M8 16l1-3 5-5 2 2-5 5z M13 9l2 2'],
  };
  const moodIcon = key => lineIcon('M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19z ' + moods[key][2]);
  window.mzStatusMoodIcon = key => Object.hasOwn(moods, key) ? moodIcon(key) : '';
  window.mzStatusMoodControls = key => `<fieldset class="mz-moods"><legend>${mzT('今日心情','Today’s mood')}</legend><div>${Object.entries(moods).map(([id,[zh,en]]) => `<label><input type="radio" name="mz-status-mood" value="${id}" ${id === key ? 'checked' : ''}><span>${moodIcon(id)}${mzT(zh,en)}</span></label>`).join('')}</div></fieldset>`;
  window.mzStatusMoodLabel = key => Object.hasOwn(moods, key) ? mzT(...moods[key].slice(0,2)) : '';

  const weatherKey = 'mz-local-weather';
  let forecast, locating, refreshing, midnightTimer;
  try { forecast = JSON.parse(localStorage.getItem(weatherKey)); } catch {}
  const day = (zone, ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(ms);
  const weatherView = () => document.querySelector('#mz-weather');
  const approximate = p => {
    if (![p.latitude,p.longitude].every(Number.isFinite)) throw Error('invalid position');
    return { latitude:Math.round(p.latitude * 10) / 10, longitude:Math.round(p.longitude * 10) / 10 };
  };
  const location = async () => {
    if (window.IOSHost) {
      const result = await Desktop.invoke('locationPermission');
      if (result?.granted && result.geo) return result.geo;
      throw Error('location denied');
    }
    if (window.MushuiDesktop && window.Desktop?.invoke) {
      const result = await Desktop.invoke('weatherLocation');
      if (result) return result;
      throw Error('location unavailable');
    }
    if (window.AndroidHost && !(await call('locationPermission'))?.granted) throw Error('location denied');
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(Error('position unavailable'));
      navigator.geolocation.getCurrentPosition(p => resolve(p.coords), reject, { enableHighAccuracy:false, timeout:12000, maximumAge:600000 });
    });
  };
  const description = code => {
    if (code === 0) return mzT('晴朗','Clear');
    if (code <= 2) return mzT('晴時多雲','Partly cloudy');
    if (code === 3) return mzT('陰天','Overcast');
    if (code <= 48) return mzT('霧','Fog');
    if (code >= 95) return mzT('雷雨','Thunderstorms');
    if (code >= 71 && code <= 77 || code >= 85) return mzT('降雪','Snow');
    return mzT('有雨','Rain');
  };
  function paintWeather(message = '') {
    const view = weatherView();
    if (!view) return;
    const data = forecast?.weather;
    const high = data?.daily?.temperature_2m_max?.[0], low = data?.daily?.temperature_2m_min?.[0];
    const report = data ? `<section class="card mz-weather-report">${lineIcon(weatherIcon)}<strong>${Math.round(data.current.temperature_2m)}°C</strong><p>${description(data.current.weather_code)}</p><p>${mzT('最高','High')} ${Math.round(high)}°C · ${mzT('最低','Low')} ${Math.round(low)}°C</p><small>${esc(data.current.time.replace('T',' '))}</small></section>` : '';
    view.innerHTML = report + `<p class="help">${esc(message || mzT('使用約略位置查詢天氣，當地午夜更新。','Uses an approximate location and refreshes at local midnight.'))}</p>
      ${forecast?.point && data && !message ? '' : `<button class="pill" data-action="mzWeatherLocate" ${locating || refreshing ? 'disabled' : ''}>${mzT('授權位置並更新','Allow location and update')}</button>`}
      <p class="small">Open-Meteo</p>`;
  }
  const schedule = () => {
    clearTimeout(midnightTimer);
    if (!forecast?.weather) return;
    const zone = forecast.weather.timezone, now = Date.now(), today = day(zone, now);
    let low = now, high = now + 26 * 3600000;
    while (high - low > 500) {
      const middle = Math.floor((high + low) / 2);
      if (day(zone, middle) === today) low = middle; else high = middle;
    }
    midnightTimer = setTimeout(() => { if (!document.hidden) refreshWeather(); }, high - Date.now() + 100);
  };
  function refreshWeather(newPoint) {
    if ((!newPoint && !forecast?.point) || refreshing || locating) return refreshing;
    if (!newPoint && forecast.weather && forecast.day === day(forecast.weather.timezone)) { schedule(); return; }
    refreshing = (async () => {
      try {
        const point = newPoint || approximate(await location());
        const query = new URLSearchParams({ latitude:point.latitude, longitude:point.longitude, timezone:'auto', forecast_days:'1', current:'temperature_2m,weather_code', daily:'temperature_2m_max,temperature_2m_min' });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),12000);
        let weather;
        try {
          const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, { signal:controller.signal, credentials:'omit', referrerPolicy:'no-referrer' });
          if (!response.ok) throw Error('weather request failed');
          weather = await response.json();
        } finally { clearTimeout(timeout); }
        const values = [weather.current?.temperature_2m, weather.current?.weather_code, weather.daily?.temperature_2m_max?.[0], weather.daily?.temperature_2m_min?.[0]];
        if (!values.every(Number.isFinite) || typeof weather.current?.time !== 'string' || !weather.timezone) throw Error('invalid forecast');
        forecast = { point, weather, day:day(weather.timezone) };
        try { localStorage.setItem(weatherKey, JSON.stringify(forecast)); } catch {}
        if (window.IOSHost) WebEngine.put(weatherKey, forecast).catch(() => {});
        schedule();
        return '';
      } catch {
        return mzT('無法更新天氣，請檢查網路後重新開啟。','Could not update weather. Check your connection and reopen.');
      }
    })().then(message => { refreshing = null; paintWeather(message); });
    paintWeather(mzT('正在更新天氣…','Updating weather…'));
    return refreshing;
  }
  actions.mzWeatherLocate = async () => {
    if (locating || refreshing) return;
    locating = true;
    paintWeather(mzT('正在取得約略位置…','Getting approximate location…'));
    let point;
    try {
      point = approximate(await location());
    } catch {
      locating = false;
      paintWeather(mzT('無法取得位置，請檢查裝置的位置權限。','Location is unavailable. Check your device permissions.'));
      return;
    }
    locating = false;
    await refreshWeather(point);
  };
  actions.mzWeather = () => {
    showModal(mzT('天氣','Weather'), '<div id="mz-weather"></div>');
    paintWeather();
    if (forecast?.point) refreshWeather();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshWeather(); });
  if (window.IOSHost && !forecast) {
    WebEngine.get(weatherKey).then(saved => {
      if (!forecast && !locating && saved?.point) {
        forecast = saved;
        paintWeather();
        if (!document.hidden) refreshWeather();
      }
    }).catch(() => {});
  } else if (forecast?.point && !document.hidden) refreshWeather();
}
