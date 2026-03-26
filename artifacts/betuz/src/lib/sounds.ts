class SoundManager {
  private ctx: AudioContext | null = null;
  private spinInterval: ReturnType<typeof setInterval> | null = null;
  private spinTimeout: ReturnType<typeof setTimeout> | null = null;
  private ambientOscillators: (OscillatorNode | AudioNode)[] = [];
  private ambientGain: GainNode | null = null;
  private ambientType: string | null = null;
  private ambientTimeout: ReturnType<typeof setTimeout> | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3, delay = 0) {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
      osc.onended = () => { try { osc.disconnect(); gainNode.disconnect(); } catch {} };
    } catch {}
  }

  win() {
    const melody = [523, 659, 784, 1046];
    melody.forEach((f, i) => this.playTone(f, 0.35, 'sine', 0.4, i * 0.1));
    this.playTone(1046, 0.7, 'sine', 0.5, 0.4);
  }

  lose() {
    [350, 280, 200].forEach((f, i) => this.playTone(f, 0.25, 'sawtooth', 0.2, i * 0.12));
  }

  click() {
    this.playTone(900, 0.04, 'square', 0.12);
  }

  spin() {
    if (this.spinInterval) { clearInterval(this.spinInterval); this.spinInterval = null; }
    if (this.spinTimeout) { clearTimeout(this.spinTimeout); this.spinTimeout = null; }
    let freq = 300;
    this.spinInterval = setInterval(() => {
      this.playTone(freq, 0.04, 'square', 0.08);
      freq = 200 + Math.random() * 300;
    }, 80);
    this.spinTimeout = setTimeout(() => {
      if (this.spinInterval) { clearInterval(this.spinInterval); this.spinInterval = null; }
    }, 3000);
  }

  coin() {
    this.playTone(1400, 0.08, 'sine', 0.25);
    this.playTone(1000, 0.12, 'sine', 0.18, 0.07);
  }

  crash() {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.7);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start(); osc.stop(ctx.currentTime + 0.7);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch {} };
      [200, 300, 180, 250].forEach((f, i) =>
        setTimeout(() => this.playTone(f, 0.15, 'square', 0.15), i * 60));
    } catch {}
  }

  explosion() {
    try {
      const ctx = this.getCtx();
      [80, 60, 100, 50].forEach((f, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.4);
          g.gain.setValueAtTime(0.3, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(); osc.stop(ctx.currentTime + 0.4);
          osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch {} };
        }, i * 50);
      });
    } catch {}
  }

  mine() {
    [200, 150, 100, 70].forEach((f, i) =>
      this.playTone(f, 0.3, 'sawtooth', 0.35, i * 0.07));
  }

  bounce() {
    const freq = 600 + Math.random() * 400;
    this.playTone(freq, 0.06, 'sine', 0.18);
  }

  reveal() {
    this.playTone(1200, 0.05, 'sine', 0.2);
    this.playTone(1500, 0.1, 'sine', 0.15, 0.05);
  }

  tick() {
    this.playTone(1100, 0.025, 'square', 0.07);
  }

  rouletteClick() {
    this.playTone(1800, 0.05, 'sine', 0.15);
    setTimeout(() => this.playTone(2200, 0.04, 'sine', 0.1), 50);
  }

  bigWin() {
    const up = [523, 659, 784, 1046, 1318];
    up.forEach((f, i) => this.playTone(f, 0.4, 'sine', 0.5, i * 0.08));
    const down = [1318, 1046, 784, 659, 523, 392, 523];
    down.forEach((f, i) => this.playTone(f, 0.3, 'sine', 0.4, 0.5 + i * 0.08));
    setTimeout(() => {
      [880, 1100, 1320, 1760].forEach((f, i) =>
        this.playTone(f, 0.5, 'sine', 0.35, i * 0.1));
    }, 1200);
  }

  stopAmbient() {
    if (this.ambientTimeout) { clearTimeout(this.ambientTimeout); this.ambientTimeout = null; }
    if (this.ambientGain) {
      try {
        const ctx = this.getCtx();
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, ctx.currentTime);
        this.ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      } catch {}
    }
    setTimeout(() => {
      this.ambientOscillators.forEach(n => { try { (n as any).stop?.(); n.disconnect(); } catch {} });
      this.ambientOscillators = [];
      this.ambientGain = null;
      this.ambientType = null;
    }, 600);
  }

  startAmbient(theme: 'crash' | 'mines' | 'roulette' | 'plinko' | 'casino') {
    if (this.ambientType === theme) return;
    this.stopAmbient();
    this.ambientType = theme;

    try {
      const ctx = this.getCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.ambientGain = masterGain;
      this.ambientOscillators = [masterGain];

      const addDrone = (freq: number, type: OscillatorType, vol: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        osc.connect(g); g.connect(masterGain);
        osc.start();
        this.ambientOscillators.push(osc, g);
      };

      if (theme === 'crash') {
        addDrone(55, 'sine', 0.15);
        addDrone(110, 'sine', 0.08);
        addDrone(220, 'triangle', 0.04);
        const playTension = () => {
          const notes = [220, 246, 261, 277, 261, 220];
          notes.forEach((f, i) => {
            setTimeout(() => {
              try { this.playTone(f, 0.8, 'sine', 0.06); } catch {}
            }, i * 600);
          });
          this.ambientTimeout = setTimeout(playTension, notes.length * 600 + 500);
        };
        setTimeout(playTension, 300);
      } else if (theme === 'mines') {
        addDrone(40, 'sine', 0.2);
        addDrone(80, 'sine', 0.08);
        const drip = () => {
          try { this.playTone(2000 + Math.random() * 500, 0.4, 'sine', 0.04); } catch {}
          this.ambientTimeout = setTimeout(drip, 1500 + Math.random() * 2000);
        };
        setTimeout(drip, 800);
      } else if (theme === 'roulette') {
        addDrone(65, 'sine', 0.1);
        const notes = [392, 440, 494, 523, 587, 659, 784, 880];
        let ni = 0;
        const playNote = () => {
          try { this.playTone(notes[ni % notes.length], 0.6, 'sine', 0.05); } catch {}
          ni++;
          this.ambientTimeout = setTimeout(playNote, 300 + Math.random() * 400);
        };
        setTimeout(playNote, 500);
      } else if (theme === 'plinko') {
        addDrone(80, 'square', 0.04);
        const bNotes = [523, 659, 784, 880, 1046];
        let bi = 0;
        const playBeat = () => {
          try { this.playTone(bNotes[bi % bNotes.length], 0.15, 'square', 0.04); } catch {}
          bi++;
          this.ambientTimeout = setTimeout(playBeat, 200 + Math.random() * 200);
        };
        setTimeout(playBeat, 200);
      } else {
        addDrone(55, 'sine', 0.1);
        addDrone(110, 'sine', 0.06);
      }

      masterGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 1.5);
    } catch {}
  }
}

export const sounds = new SoundManager();
