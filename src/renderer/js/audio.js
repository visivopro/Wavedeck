// Audio engine: <audio> element -> preamp -> 10-band EQ -> balance -> volume -> out
// with analysers tapped for the visualizers.

export const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];

export function mediaUrl(track) {
  if (track.url) return track.url;
  return 'media://local/?p=' + encodeURIComponent(track.path);
}

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.el.preload = 'auto';
    this.ctx = null;
    this.volume = 75;      // 0..100
    this.balance = 0;      // -100..100
    this.preamp = 0;       // dB -12..12
    this.bands = EQ_BANDS.map(() => 0); // dB -12..12
    this.eqOn = true;
    for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'error', 'waiting', 'playing', 'emptied']) {
      this.el.addEventListener(ev, () => this.dispatchEvent(new Event(ev)));
    }
  }

  ensureGraph() {
    if (this.ctx) return;
    const ctx = this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.source = ctx.createMediaElementSource(this.el);
    this.preampNode = ctx.createGain();
    this.filters = EQ_BANDS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      b.frequency.value = f;
      b.Q.value = 1.1;
      return b;
    });
    this.panner = ctx.createStereoPanner();
    this.gain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.0;
    this.splitter = ctx.createChannelSplitter(2);
    this.analyserL = ctx.createAnalyser(); this.analyserL.fftSize = 1024;
    this.analyserR = ctx.createAnalyser(); this.analyserR.fftSize = 1024;
    // Plugin insertion point sits between the EQ chain and the balance stage.
    this.fxIn = ctx.createGain();
    this.fxOut = ctx.createGain();
    this.fxIn.connect(this.fxOut);

    let node = this.source.connect(this.preampNode);
    for (const f of this.filters) node = node.connect(f);
    node.connect(this.fxIn);
    this.fxOut.connect(this.panner).connect(this.gain);
    this.gain.connect(ctx.destination);
    this.gain.connect(this.analyser);
    this.gain.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0);
    this.splitter.connect(this.analyserR, 1);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.timeL = new Uint8Array(1024);
    this.timeR = new Uint8Array(1024);
    this.applyAll();
  }

  // Replace the effect chain a plugin provides: fn(ctx, input, output)
  setEffectChain(build) {
    this.ensureGraph();
    this.fxIn.disconnect();
    if (!build) { this.fxIn.connect(this.fxOut); return; }
    try { build(this.ctx, this.fxIn, this.fxOut); } catch (e) { console.error(e); this.fxIn.connect(this.fxOut); }
  }

  applyAll() {
    this.setVolume(this.volume); this.setBalance(this.balance);
    this.setPreamp(this.preamp); this.bands.forEach((v, i) => this.setBand(i, v));
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(100, v));
    const g = Math.pow(this.volume / 100, 2);
    if (this.gain) this.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.01);
    else this.el.volume = g;
  }
  setBalance(b) {
    this.balance = Math.max(-100, Math.min(100, b));
    if (this.panner) this.panner.pan.value = this.balance / 100;
  }
  setPreamp(db) {
    this.preamp = db;
    if (this.preampNode) this.preampNode.gain.value = this.eqOn ? Math.pow(10, db / 20) : 1;
  }
  setBand(i, db) {
    this.bands[i] = db;
    if (this.filters) this.filters[i].gain.value = this.eqOn ? db : 0;
  }
  setEqOn(on) { this.eqOn = on; this.applyAll(); }

  load(track) {
    this.ensureGraph();
    this.track = track;
    this.el.src = mediaUrl(track);
  }
  async play() {
    this.ensureGraph();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.el.src) return;
    try { await this.el.play(); } catch (e) { if (e.name !== 'AbortError') this.dispatchEvent(new Event('error')); }
  }
  pause() { this.el.pause(); }
  stop() { this.el.pause(); try { this.el.currentTime = 0; } catch { /* not loaded */ } this.stopped = true; this.dispatchEvent(new Event('stopped')); }
  seek(sec) { if (isFinite(sec)) this.el.currentTime = Math.max(0, Math.min(sec, this.duration || sec)); }
  get time() { return this.el.currentTime || 0; }
  get duration() { const d = this.el.duration; return isFinite(d) ? d : (this.track && this.track.duration) || 0; }
  get playing() { return !this.el.paused && !this.el.ended; }
  get paused() { return this.el.paused && this.el.currentTime > 0 && !this.stopped; }

  spectrum() { if (!this.analyser) return null; this.analyser.getByteFrequencyData(this.freqData); return this.freqData; }
  waveform() { if (!this.analyser) return null; this.analyser.getByteTimeDomainData(this.timeData); return this.timeData; }
  // Shape butterchurn expects
  levels() {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.timeData);
    this.analyserL.getByteTimeDomainData(this.timeL);
    this.analyserR.getByteTimeDomainData(this.timeR);
    return { timeByteArray: this.timeData.subarray(0, 1024), timeByteArrayL: this.timeL, timeByteArrayR: this.timeR };
  }
}
