'use strict';
// 3.4.1: local helplines. When someone says something that sounds like a crisis, the App asks right then for
// their rough location (the system permission prompt), works out the country on the device, and:
//  - shows that country's emergency number and helpline instead of always Taiwan's 119 / 1925;
//  - tells the server the country (only the two-letter code, never the coordinates), so the notes 沐水 sends to
//    the emergency contacts name the same local numbers.
// Without permission (or no location), the phone's time zone is the guess; the last answer is remembered.
{
  const W = WebEngine;
  const LINES = {
    TW: ['119', '1925 安心專線（24 小時）', '119', 'the 1925 helpline (24 hours)'],
    CA: ['911', '988 自殺危機專線（可打電話或傳簡訊，24 小時）', '911', '988, the Suicide Crisis Helpline (call or text, 24 hours)'],
    US: ['911', '988 自殺與危機專線（可打電話或傳簡訊，24 小時）', '911', '988, the Suicide & Crisis Lifeline (call or text, 24 hours)'],
    HK: ['999', '撒瑪利亞防止自殺會 2389 2222（24 小時）', '999', 'The Samaritan Befrienders 2389 2222 (24 hours)'],
    MO: ['999', '明愛生命熱線 2852 5222（24 小時）', '999', 'Caritas Life Hope Hotline 2852 5222 (24 hours)'],
    CN: ['120 或 110', '希望 24 熱線 400-161-9995（24 小時）', '120 or 110', 'Hope 24 Hotline 400-161-9995 (24 hours)'],
    JP: ['119', 'いのちの電話 0570-783-556', '119', 'Inochi no Denwa 0570-783-556'],
    KR: ['119', '自殺預防諮詢電話 109（24 小時）', '119', 'the suicide prevention line 109 (24 hours)'],
    SG: ['995', 'SOS 1767（24 小時）', '995', 'SOS 1767 (24 hours)'],
    MY: ['999', 'Talian HEAL 15555', '999', 'Talian HEAL 15555'],
    GB: ['999', 'Samaritans 116 123（24 小時）', '999', 'Samaritans 116 123 (24 hours)'],
    AU: ['000', 'Lifeline 13 11 14（24 小時）', '000', 'Lifeline 13 11 14 (24 hours)'],
    NZ: ['111', '1737（可打電話或傳簡訊，24 小時）', '111', '1737 (call or text, 24 hours)'],
  };
  // Rough boxes (south, north, west, east). Where boxes overlap (Canada / US, Japan / Korea…), the time zone decides.
  const BOXES = {
    MO: [22.1, 22.22, 113.52, 113.6], HK: [22.15, 22.57, 113.83, 114.45], TW: [21.8, 26.4, 118.1, 122.1],
    SG: [1.15, 1.48, 103.6, 104.1], JP: [24, 45.6, 122.9, 146], KR: [33, 38.7, 124.5, 131], CN: [18, 53.6, 73.5, 135],
    MY: [0.8, 7.4, 99.6, 119.3], GB: [49.8, 60.9, -8.7, 1.8], AU: [-44, -10, 112.9, 153.7], NZ: [-47.4, -34.3, 166, 178.6],
    CA: [41.6, 83.2, -141, -52.6], US: [24.4, 49.4, -125, -66.9], US2: [51, 71.5, -170, -130], US3: [18.9, 22.3, -160.3, -154.8],
  };
  const fromZone = () => {
    let z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
    const map = { 'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK', 'Asia/Macau': 'MO', 'Asia/Shanghai': 'CN', 'Asia/Chongqing': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY', 'Europe/London': 'GB', 'Pacific/Auckland': 'NZ', 'Pacific/Honolulu': 'US' };
    if (map[z]) return map[z];
    if (/^Australia\//.test(z)) return 'AU';
    if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Dawson_Creek|Dawson|Swift_Current|Rankin_Inlet|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon|Creston|Fort_Nelson|Resolute|Thunder_Bay|Nipigon|Rainy_River|Pangnirtung)$/.test(z)) return 'CA';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Metlakatla|Yakutat|Menominee|Indiana\/.*|Kentucky\/.*|North_Dakota\/.*)$/.test(z)) return 'US';
    return '';
  };
  const fromPoint = (lat, lon) => {
    const hits = [...new Set(Object.entries(BOXES).filter(([, b]) => lat >= b[0] && lat <= b[1] && lon >= b[2] && lon <= b[3]).map(([k]) => k.slice(0, 2)))];
    if (hits.length === 1) return hits[0];
    if (!hits.length) return fromZone();
    const z = fromZone();
    return hits.includes(z) ? z : hits[0];
  };
  const KEY = 'mzCrisisPlace';
  const remembered = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.code || ''; } catch { return ''; } };
  const remember = (code) => { try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch {} };
  const now = () => remembered() || fromZone() || 'TW';

  // Ask for the rough location now (the permission prompt shows the first time), give up after 10 seconds.
  let asking = null;
  const locate = () => asking || (asking = (async () => {
    try {
      if (window.AndroidHost) { const r = await call('preciseLocationPermission'); if (!r?.granted) throw Error('no'); }
      if (!navigator.geolocation) throw Error('no');
      const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 }));
      const code = fromPoint(pos.coords.latitude, pos.coords.longitude);
      if (code) remember(code);
      return code || now();
    } catch { const z = fromZone(); if (z && !remembered()) remember(z); return now(); }
    finally { setTimeout(() => { asking = null; }, 0); }
  })());
  const tell = (code) => { try { if (humanData().connected) W.humanRequest('/v1/emergency', { place: code }).catch(() => {}); } catch {} };

  const english = () => { try { const l = state.settings.uiLanguage; return l === 'en' || (l !== 'zh-Hant' && /^en/i.test(navigator.language || '')); } catch { return false; } };
  const line = (code, en) => {
    const x = LINES[code];
    if (en) return x ? `If you are in danger right now, please call ${x[2]}. To talk to someone, you can call ${x[3]}.` : 'If you are in danger right now, please call your local emergency number. Talking to someone at a local crisis line can help too.';
    return x ? `如果你現在有危險，請馬上打 ${x[0]}。想找人說說話，也可以打 ${x[1]}。` : '如果你現在有危險，請馬上打當地的緊急電話。想找人說說話，也可以打當地的自殺防治或心理支持專線。';
  };
  // For the voice AI's instructions: the numbers for where the person last was.
  window.mzHotlineLine = () => { const x = LINES[now()]; return x ? `有危險打 ${x[0]}、想說話可打 ${x[1]}` : '有危險打當地的緊急電話、想說話可打當地的心理支持專線'; };

  // Every time a message sounds like a crisis: ask where they are right then, tell the server, and use the local
  // numbers in the help note (the note itself still shows at most once a week unless it's urgent).
  const before = W.crisisHelpOnce;
  if (typeof before === 'function') {
    W.crisisHelpOnce = async (text) => {
      const where = locate();
      where.then(tell);
      const shown = await before(text);
      if (!shown) return '';
      const code = await Promise.race([where, new Promise((r) => setTimeout(() => r(now()), 6000))]);
      return line(code, english());
    };
  }
  // Ask already when the message is sent (not only when the reply comes back), so the server's note to the
  // emergency contacts, which goes out at about the same time, gets the local numbers too.
  document.addEventListener('submit', (e) => {
    try { const box = e.target.querySelector?.('textarea'); if (box && W.crisisText?.(box.value)) locate().then(tell); } catch {}
  }, true);
  window.mzCrisisPlace = { locate, fromPoint, fromZone, line, here: now };
}
