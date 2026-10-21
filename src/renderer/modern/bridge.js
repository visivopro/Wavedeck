// Bridge between the modern-skin engine (Winamp 5 .wal, WMP .wmz, Sonique …)
// and Wavedeck. The skin's buttons, sliders, EQ, visualizer and playlist all
// drive the Wavedeck player running in the (hidden) main window, so the
// library, Browse tab, mixtapes and server streaming keep working.
(function () {
  const WD = () => window.opener && window.opener.wavedeckPlayer;
  const app = () => WD() && WD().app;

  class Emitter {
    constructor() { this.map = new Map(); }
    on(ev, cb) { if (!this.map.has(ev)) this.map.set(ev, new Set()); this.map.get(ev).add(cb); return () => this.off(ev, cb); }
    off(ev, cb) { const s = this.map.get(ev); if (s) s.delete(cb); }
    trigger(ev, ...args) { const s = this.map.get(ev); if (s) for (const cb of [...s]) { try { cb(...args); } catch (e) { console.error(e); } } }
  }

  // Looks like an AnalyserNode, but reads the main window's analyser.
  class RemoteAnalyser {
    constructor() { this.fftSize = 1024; this.frequencyBinCount = 512; this.smoothingTimeConstant = 0; this.minDecibels = -100; this.maxDecibels = -30; }
    getByteFrequencyData(arr) {
      const src = app() && app().engine.spectrum();
      if (!src) { arr.fill(0); return; }
      const ratio = src.length / arr.length;
      for (let i = 0; i < arr.length; i++) {
        let m = 0; const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
        for (let k = a; k < b && k < src.length; k++) if (src[k] > m) m = src[k];
        arr[i] = m;
      }
    }
    getByteTimeDomainData(arr) {
      const src = app() && app().engine.waveform();
      if (!src) { arr.fill(128); return; }
      const ratio = src.length / arr.length;
      for (let i = 0; i < arr.length; i++) arr[i] = src[Math.floor(i * ratio)];
    }
    getFloatTimeDomainData(arr) {
      const tmp = new Uint8Array(arr.length); this.getByteTimeDomainData(tmp);
      for (let i = 0; i < arr.length; i++) arr[i] = (tmp[i] - 128) / 128;
    }
    getFloatFrequencyData(arr) {
      const tmp = new Uint8Array(arr.length); this.getByteFrequencyData(tmp);
      for (let i = 0; i < arr.length; i++) arr[i] = this.minDecibels + (tmp[i] / 255) * (this.maxDecibels - this.minDecibels);
    }
    connect() {} disconnect() {}
  }

  class RemoteAudio {
    constructor() {
      this._events = new Emitter();
      this._eqEmitter = new Emitter();
      this._analyser = new RemoteAnalyser();
      this._timeRemaining = false;
      this._albumArtUrl = null;
      this._trackInfo = {};
      this._vuMeter = 0;
      this._lastSec = -1;
      this._last = {};
      this._ctx = null;
      this._seekCbs = new Set();
      this._poll = setInterval(() => this._tick(), 200);
      const vu = new Float32Array(1024);
      const frame = () => {
        this._analyser.getFloatTimeDomainData(vu);
        let s = 0; for (let i = 0; i < vu.length; i++) s += vu[i] * vu[i];
        this._vuMeter = Math.sqrt(s / vu.length);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
    get _context() { if (!this._ctx) this._ctx = new AudioContext(); return this._ctx; }
    _tick() {
      const a = app(); if (!a) return;
      const st = a.state, e = a.engine;
      const sec = Math.floor(e.time);
      if (sec !== this._lastSec) { this._lastSec = sec; this.trigger('timeupdate'); }
      const snap = { status: st.status, vol: st.volume, bal: st.balance, eqOn: st.eq.on, pre: st.eq.preamp, bands: st.eq.bands.join(',') };
      const L = this._last;
      if (snap.status !== L.status) { this.trigger(snap.status === 'playing' ? 'play' : snap.status === 'paused' ? 'pause' : 'stop'); this.trigger('statchanged'); }
      if (snap.vol !== L.vol) this.trigger('volumechanged');
      if (snap.bal !== L.bal) this.trigger('balancechange');
      if (snap.pre !== L.pre) this._eqEmitter.trigger('preamp');
      if (snap.bands !== L.bands) { const old = (L.bands || '').split(','); st.eq.bands.forEach((v, i) => { if (String(v) !== old[i]) this._eqEmitter.trigger(String(i + 1)); }); }
      if (snap.eqOn !== L.eqOn) this.trigger('eqchanged');
      this._last = snap;
    }
    on(ev, cb) { return this._events.on(ev, cb); }
    off(ev, cb) { this._events.off(ev, cb); }
    trigger(ev, ...args) { this._events.trigger(ev, ...args); }
    getAnalyser() { return this._analyser; }
    setAudioSource() { /* the playlist bridge plays tracks through Wavedeck */ }
    getVolume() { const a = app(); return a ? a.state.volume / 100 : 0.75; }
    setVolume(v) { const a = app(); if (!a) return; const n = Math.round(Math.max(0, Math.min(1, v)) * 100); if (n !== a.state.volume) { a.setVolume(n); this.trigger('volumechanged'); } }
    getBalance() { const a = app(); return a ? a.state.balance / 100 : 0; }
    setBalance(b) { const a = app(); if (!a) return; if (Math.abs(b) > 1) b = b / 127; a.setBalance(Math.round(b * 100)); this.trigger('balancechange'); }
    getPlaybackRate() { const a = app(); return a ? a.engine.el.playbackRate : 1; }
    setPlaybackRate(v) { const a = app(); if (a) a.engine.el.playbackRate = Math.max(0.5, Math.min(4, v)); this.trigger('playbackratechange'); }
    play() { const a = app(); if (a) a.play(); }
    pause() { const a = app(); if (a) a.pause(); }
    stop() { const a = app(); if (a) a.stop(); }
    seekTo(secs) { const a = app(); if (a) { a.seekTo(secs); this._seekCbs.forEach((cb) => cb()); } }
    seekToPercent(p) { const a = app(); if (a) this.seekTo(p * a.engine.duration); }
    toggleRemainingTime() { this._timeRemaining = !this._timeRemaining; }
    getCurrentTime() { const a = app(); if (!a) return 0; const t = a.engine.time, d = a.engine.duration; return this._timeRemaining ? t - d : t; }
    getCurrentTimePercent() { const a = app(); if (!a || !a.engine.duration) return 0; return a.engine.time / a.engine.duration; }
    getLength() { const a = app(); return a ? a.engine.duration : 0; }
    getState() { const a = app(); return a ? a.state.status : 'stopped'; }
    getEqEnabled() { const a = app(); return a ? a.state.eq.on : true; }
    setEqEnabled(on) { const a = app(); if (a) a.setEqOn(!!on); this.trigger('eqchanged'); }
    getEq(kind) {
      const a = app(); if (!a) return 0.5;
      const db = kind === 'preamp' ? a.state.eq.preamp : a.state.eq.bands[Number(kind) - 1] || 0;
      return (db + 12) / 24;
    }
    setEq(kind, value) {
      const a = app(); if (!a) return;
      const db = Math.round((value * 24 - 12) * 10) / 10;
      if (kind === 'preamp') a.setPreamp(db); else { const i = Number(kind) - 1; if (i >= 0 && i < 10) a.setBand(i, db); }
      this._eqEmitter.trigger(kind);
    }
    onEqChange(kind, cb) { return this._eqEmitter.on(kind, cb); }
    onCurrentTimeChange(cb) { return this.on('timeupdate', cb); }
    onSeek(cb) { this._seekCbs.add(cb); return () => this._seekCbs.delete(cb); }
    onVolumeChanged(cb) { return this.on('volumechanged', cb); }
    onBalanceChanged(cb) { return this.on('balancechange', cb); }
  }

  window.__WAVEDECK_AUDIO__ = () => (window.__wdAudio = new RemoteAudio());
})();
