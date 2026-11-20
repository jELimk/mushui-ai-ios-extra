'use strict';
// Voice noise suppression with RNNoise (public, open source):
//   suppressor: @sapphi-red/web-noise-suppressor v0.3.5 (MIT) — https://github.com/sapphi-red/web-noise-suppressor
//   RNNoise core: BSD-3-Clause — https://github.com/xiph/rnnoise
// Vendored under assets/vendor/ (rnnoise-worklet.js, rnnoise.wasm, rnnoise_simd.wasm); no CDN at runtime.
// window.mzNoiseProcess(stream) returns a cleaned stream when the 降噪 switch is on, and the original
// stream on any failure (old browser, no AudioWorklet, wasm blocked), so recording/calls never break.
{
  let wasm = null, mod = null;
  const simdOk = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } };
  const load = async () => {
    if (!wasm) wasm = await (await fetch('vendor/' + (simdOk() ? 'rnnoise_simd.wasm' : 'rnnoise.wasm'))).arrayBuffer();
    return wasm;
  };
  window.mzNoiseProcess = async (stream) => {
    try {
      if (window.mzNoiseOn?.() === false || !window.AudioWorkletNode) return stream;
      const ctx = new AudioContext({ sampleRate: 48000 });
      if (!mod) mod = ctx.audioWorklet.addModule('vendor/rnnoise-worklet.js'); await mod;
      const node = new AudioWorkletNode(ctx, '@sapphi-red/web-noise-suppressor/rnnoise', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, processorOptions: { wasmBinary: await load(), maxChannels: 1 } });
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(stream).connect(node); node.connect(dest);
      const out = dest.stream, clean = () => { try { ctx.close(); } catch {} stream.getTracks().forEach((t) => { try { t.stop(); } catch {} }); };
      out.getAudioTracks()[0]?.addEventListener('ended', clean);
      stream.getAudioTracks()[0]?.addEventListener('ended', () => { try { ctx.close(); } catch {} });
      await ctx.resume().catch(() => {});
      return out;
    } catch { return stream; }
  };
}
