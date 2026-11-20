'use strict';
// 3.4.2: on Android the 提示音 (new-message notice and the incoming-call ringtone) play as a real notification sound:
// the phone's notification volume (ring volume for the ringtone), silent when the phone is on silent — not the media
// volume. The sound (the user's own file, or Mizuki's original tones made into a short WAV) is handed to Android.
// Call beeps (connected, ended, mute…) stay in-app. Anything that fails falls back to the old in-app sound.
{
  if (window.AndroidHost && window.Desktop?.invoke && typeof playQueuedSound === 'function') {
    const PATTERNS = { notice: [[784, 0], [1046, 0.11]], ringtone: [[659, 0], [784, 0.18], [988, 0.46], [784, 0.64]] };
    const wav = (kind) => {
      const rate = 22050, seq = PATTERNS[kind], len = Math.ceil((seq[seq.length - 1][1] + 0.3) * rate), pcm = new Float32Array(len);
      for (const [hz, at] of seq) {
        const start = Math.floor(at * rate), n = Math.floor(0.2 * rate);
        for (let i = 0; i < n && start + i < len; i++) {
          const t = i / rate, env = t < 0.025 ? t / 0.025 : Math.exp(-(t - 0.025) * 22);
          pcm[start + i] += Math.sin(2 * Math.PI * hz * t) * env * 0.5;
        }
      }
      const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * 2, true);
      for (let i = 0; i < len; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
      let bin = ''; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return 'data:audio/wav;base64,' + btoa(bin);
    };
    const cache = {};
    const webSound = playQueuedSound;
    playQueuedSound = async function (kind, ...rest) {
      if (kind !== 'notice' && kind !== 'ringtone') return webSound.call(this, kind, ...rest);
      try {
        if (soundCfg.enabled[kind] === false) return;
        const data = soundCfg.custom[kind] || (cache[kind] ||= wav(kind));
        await Desktop.invoke('alertSound', { data, kind });
        await new Promise((r) => setTimeout(r, kind === 'ringtone' ? 900 : 300));
      } catch { return webSound.call(this, kind, ...rest); }
    };
  }
}
