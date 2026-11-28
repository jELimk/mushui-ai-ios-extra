'use strict';
// RNNoise runs in a 48 kHz AudioWorklet. Keep the system-processed input as a fallback.
{
  let binary;
  const model = () => binary ||= fetch(new URL('vendor/rnnoise/rnnoise.wasm', document.baseURI))
    .then(response => { if (!response.ok) throw Error('RNNoise unavailable'); return response.arrayBuffer(); })
    .catch(error => { binary = null; throw error; });
  window.mzDenoiseMicrophone = async (stream) => {
    const input = stream.getAudioTracks()[0];
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!input || !Audio || typeof AudioWorkletNode !== 'function') return stream;
    let context, timer, processor;
    try {
      context = new Audio({ sampleRate: 48000 });
      if (context.sampleRate !== 48000 || !context.audioWorklet) throw Error('Unsupported RNNoise sample rate');
      const [, wasmBinary] = await Promise.race([
        Promise.all([context.audioWorklet.addModule(new URL('vendor/rnnoise/worklet.js', document.baseURI)), model(), context.resume()]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('RNNoise startup timeout')), 1600); }),
      ]);
      const source = context.createMediaStreamSource(stream);
      const destination = context.createMediaStreamDestination();
      const output = destination.stream.getAudioTracks()[0];
      const fallback = () => { if (!processor) return; source.disconnect(); source.connect(destination); processor.disconnect(); processor.port.postMessage('destroy'); processor = null; };
      processor = new AudioWorkletNode(context, '@sapphi-red/web-noise-suppressor/rnnoise', {
        channelCount: 1, channelCountMode: 'explicit',
        processorOptions: { maxChannels: 1, wasmBinary },
      });
      processor.addEventListener('processorerror', fallback, { once: true });
      source.connect(processor).connect(destination);
      clearTimeout(timer);
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(Error('RNNoise initialization timeout')), 1200);
        processor.port.onmessage = ({data}) => data === 'ready' ? resolve() : reject(Error('RNNoise initialization failed'));
      });
      const stop = output.stop.bind(output);
      let closed = false;
      output.stop = () => {
        if (closed) return;
        closed = true;
        stop();
        input.stop();
        processor?.port.postMessage('destroy');
        context.close().catch(() => {});
      };
      input.addEventListener('ended', () => output.stop(), { once: true });
      window.mzDenoisedMicrophones ||= new WeakSet();
      window.mzDenoisedMicrophones.add(destination.stream);
      return destination.stream;
    } catch {
      await context?.close().catch(() => {});
      return stream;
    } finally { clearTimeout(timer); }
  };
}
