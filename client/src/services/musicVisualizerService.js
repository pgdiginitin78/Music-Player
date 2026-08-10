/**
 * musicVisualizerService.js
 * 
 * Abstract audio analysis and rhythm synthesis engine.
 * Supports:
 * 1. Web Audio API (AnalyserNode FFT) when a CORS-compliant HTML5 Audio source is available.
 * 2. High-fidelity deterministic pseudo-audio rhythm synthesizer fallback for YouTube IFrame Player playback.
 * 
 * Guarantees smooth exponential lerp interpolation and zero audio extraction / proxying / DRM bypassing.
 */

class MusicVisualizerService {
  constructor() {
    // Real Web Audio API nodes
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.frequencyData = null;
    this.isWebAudioActive = false;

    // Smoothed visual metrics (range 0.0 to 1.0)
    this.metrics = {
      bass: 0.15,
      mid: 0.15,
      treble: 0.15,
      volume: 0.8,
      beatPulse: 0.0,
      overallIntensity: 0.15,
    };

    // Target values before interpolation
    this.targets = {
      bass: 0.15,
      mid: 0.15,
      treble: 0.15,
      volume: 0.8,
      beatPulse: 0.0,
      overallIntensity: 0.15,
    };

    // Rhythm engine internal state
    this.lastBeatTime = 0;
  }

  /**
   * Optionally connect a standard HTML5 Audio element if used.
   */
  connectAudioElement(audioElement) {
    if (!audioElement || this.isWebAudioActive) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.isWebAudioActive = true;
    } catch (err) {
      console.warn('[VISUALIZER SERVICE] Web Audio API init skipped/unavailable:', err.message);
      this.isWebAudioActive = false;
    }
  }

  /**
   * Calculate a deterministic hash code for a song string to give each song a unique tempo/rhythmic signature.
   */
  getSongHash(song) {
    if (!song) return 12345;
    const str = (song.id || song.youtubeSongId || song.title || 'default_song') + '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Main update function called every animation frame by Three.js background component.
   */
  update({ isPlaying, currentTime = 0, duration = 0, currentSong = null, category = 'default', volume = 1.0, delta = 0.016 }) {
    if (this.isWebAudioActive && this.analyser) {
      this.updateWebAudio();
    } else {
      this.updateRhythmSynthesizer({ isPlaying, currentTime, duration, currentSong, category, volume });
    }

    // Exponential lerp smoothing factors (0.05 to 0.12 prevents any jitter)
    const lerpFactor = isPlaying ? 0.08 : 0.04;

    this.metrics.bass += (this.targets.bass - this.metrics.bass) * lerpFactor;
    this.metrics.mid += (this.targets.mid - this.metrics.mid) * lerpFactor;
    this.metrics.treble += (this.targets.treble - this.metrics.treble) * lerpFactor;
    this.metrics.volume += (this.targets.volume - this.metrics.volume) * lerpFactor;
    this.metrics.overallIntensity += (this.targets.overallIntensity - this.metrics.overallIntensity) * lerpFactor;

    // Decay beat pulse quickly for crisp beats
    this.metrics.beatPulse *= 0.92;
    if (this.metrics.beatPulse < 0.001) this.metrics.beatPulse = 0;

    return this.metrics;
  }

  /**
   * FFT Frequency Analysis when Web Audio API is active
   */
  updateWebAudio() {
    if (!this.analyser || !this.frequencyData) return;
    this.analyser.getByteFrequencyData(this.frequencyData);

    const binCount = this.frequencyData.length;
    let bassSum = 0, midSum = 0, trebleSum = 0;

    const bassBins = Math.floor(binCount * 0.1);
    const midBins = Math.floor(binCount * 0.5);

    for (let i = 0; i < binCount; i++) {
      const val = this.frequencyData[i] / 255.0;
      if (i < bassBins) {
        bassSum += val;
      } else if (i < midBins) {
        midSum += val;
      } else {
        trebleSum += val;
      }
    }

    const rawBass = bassSum / Math.max(1, bassBins);
    const rawMid = midSum / Math.max(1, midBins - bassBins);
    const rawTreble = trebleSum / Math.max(1, binCount - midBins);

    this.targets.bass = rawBass;
    this.targets.mid = rawMid;
    this.targets.treble = rawTreble;
    this.targets.overallIntensity = (rawBass * 0.5 + rawMid * 0.3 + rawTreble * 0.2);

    if (rawBass > 0.6 && rawBass - this.metrics.bass > 0.25) {
      this.metrics.beatPulse = 1.0;
    }
  }

  /**
   * Fallback Rhythm Synthesizer when raw FFT data is not available (e.g. YouTube player)
   */
  updateRhythmSynthesizer({ isPlaying, currentTime, currentSong, category, volume }) {
    if (!isPlaying) {
      // Ambient slow drift when paused
      this.targets.bass = 0.08;
      this.targets.mid = 0.08;
      this.targets.treble = 0.08;
      this.targets.volume = volume * 0.3;
      this.targets.overallIntensity = 0.08;
      return;
    }

    const songHash = this.getSongHash(currentSong);
    
    // Category tempo & intensity profiles
    let baseBpm = 100;
    let categoryMultiplier = 1.0;

    switch (category) {
      case 'party-hindi':
      case 'workout-hindi':
      case 'bollywood-hits':
        baseBpm = 124;
        categoryMultiplier = 1.35;
        break;
      case 'romantic-hindi':
      case 'lo-fi-hindi':
      case 'acoustic-hindi':
        baseBpm = 76;
        categoryMultiplier = 0.75;
        break;
      case 'sad-hindi':
      case 'rain-hindi':
        baseBpm = 68;
        categoryMultiplier = 0.65;
        break;
      case 'old-hindi':
      case 'indie-hindi':
        baseBpm = 88;
        categoryMultiplier = 0.85;
        break;
      default:
        baseBpm = 104;
        categoryMultiplier = 1.0;
    }

    // Unique BPM shift per song (+- 15 BPM)
    const bpm = baseBpm + (songHash % 30) - 15;
    const bps = bpm / 60.0;
    const beatPeriod = 1.0 / bps;

    const time = currentTime || (performance.now() * 0.001);

    // Rhythmic bass pulse (sine wave raised to power for punchy beat shape)
    const beatPhase = (time % beatPeriod) / beatPeriod;
    const bassPulse = Math.pow(Math.max(0, Math.sin(beatPhase * Math.PI)), 4.0);

    // Dynamic wave calculations
    const lowWave = Math.sin(time * bps * Math.PI) * 0.2 + 0.3;
    const midWave = Math.sin(time * 1.5 + (songHash % 10)) * 0.25 + 0.35;
    const trebleWave = Math.cos(time * 3.7 + (songHash % 7)) * 0.2 + 0.3;

    const synthBass = Math.min(1.0, (lowWave + bassPulse * 0.5) * categoryMultiplier);
    const synthMid = Math.min(1.0, midWave * categoryMultiplier);
    const synthTreble = Math.min(1.0, trebleWave * categoryMultiplier);

    this.targets.bass = Math.max(0.12, synthBass);
    this.targets.mid = Math.max(0.12, synthMid);
    this.targets.treble = Math.max(0.12, synthTreble);
    this.targets.volume = Math.max(0.2, volume);
    this.targets.overallIntensity = Math.min(1.0, (synthBass * 0.5 + synthMid * 0.3 + synthTreble * 0.2) * volume);

    // Beat pulse detection trigger
    if (beatPhase < 0.12 && (time - this.lastBeatTime) > beatPeriod * 0.7) {
      this.lastBeatTime = time;
      this.metrics.beatPulse = Math.min(1.0, 0.7 + categoryMultiplier * 0.3);
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

export const musicVisualizerService = new MusicVisualizerService();
export default musicVisualizerService;
