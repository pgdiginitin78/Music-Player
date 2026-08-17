/**
 * Premium Voice Service Abstraction for PARO
 * Dynamically selects natural, warm, cute young adult Indian Hindi female system voices
 * across Windows, macOS, iOS Safari, Android, and Chrome.
 */

class VoiceService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.selectedVoice = null;
    this.voicesLoaded = false;
    this.rate = 0.94;  // Natural, warm conversational speed (0.92x - 0.95x)
    this.pitch = 1.06; // Cute, pleasant young adult female pitch
    this.volume = 0.95;

    if (this.synth) {
      this.initVoices();
    }
  }

  initVoices() {
    if (!this.synth) return;

    const load = () => {
      const voices = this.synth.getVoices();
      if (voices.length > 0) {
        this.voicesLoaded = true;
        this.selectedVoice = this.selectParoVoice(voices);
      }
    };

    load();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  /**
   * Dynamically inspects and selects the best available Indian Hindi / English Female voice.
   */
  selectParoVoice(voices = []) {
    if (!voices || voices.length === 0) return null;

    // 1. Hindi India (hi-IN) Female Voices
    const hindiFemaleKeywords = [
      'google हिन्दी',
      'google hindi',
      'microsoft swara',
      'microsoft hemant',
      'hi-in',
      'hi_in',
      'hindi',
    ];

    for (const kw of hindiFemaleKeywords) {
      const found = voices.find((v) => {
        const name = v.name.toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        return (name.includes(kw) || lang.includes('hi')) &&
          (name.includes('female') || name.includes('swara') || name.includes('google') || name.includes('hi'));
      });
      if (found) {
        console.log(`[PARO VOICE SERVICE] Selected Hindi female voice: "${found.name}" (${found.lang})`);
        return found;
      }
    }

    // 2. Any Hindi Voice (hi-IN / hi)
    const anyHindi = voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi'));
    if (anyHindi) {
      console.log(`[PARO VOICE SERVICE] Selected Hindi voice: "${anyHindi.name}" (${anyHindi.lang})`);
      return anyHindi;
    }

    // 3. Indian English (en-IN) Female Voices
    const indianEnglishFemaleKeywords = [
      'microsoft heera',
      'google indian english female',
      'google english (india)',
      'veena',
      'neerja',
      'en-in',
      'en_in',
    ];

    for (const kw of indianEnglishFemaleKeywords) {
      const found = voices.find((v) => {
        const name = v.name.toLowerCase();
        const lang = (v.lang || '').toLowerCase();
        return name.includes(kw) || lang.includes('en-in') || lang.includes('en_in');
      });
      if (found) {
        console.log(`[PARO VOICE SERVICE] Selected Indian English voice fallback: "${found.name}" (${found.lang})`);
        return found;
      }
    }

    // 4. Natural English Female Voices across macOS / Windows / iOS / Android / Chrome
    const femaleKeywords = [
      'google uk english female',
      'google us english',
      'microsoft ava neural',
      'microsoft emma neural',
      'microsoft aria neural',
      'microsoft zira',
      'samantha',
      'victoria',
      'karen',
      'fiona',
      'female',
    ];

    for (const kw of femaleKeywords) {
      const found = voices.find((v) => v.name.toLowerCase().includes(kw));
      if (found) {
        console.log(`[PARO VOICE SERVICE] Selected English female fallback voice: "${found.name}" (${found.lang})`);
        return found;
      }
    }

    // 5. Ultimate Fallback to any English or system voice
    const fallback = voices.find((v) => (v.lang || '').startsWith('en')) || voices[0];
    console.log(`[PARO VOICE SERVICE] Fallback voice selected: "${fallback.name}"`);
    return fallback;
  }

  /**
   * Cleans spoken text by stripping emojis and formatting for clean TTS pronunciation.
   */
  cleanSpokenText(text) {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  speak(text, onStart = null, onEnd = null) {
    if (!this.synth || !text) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = this.cleanSpokenText(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      if (!this.selectedVoice && this.synth.getVoices().length > 0) {
        this.selectedVoice = this.selectParoVoice(this.synth.getVoices());
      }

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = (err) => {
        console.warn('[PARO VOICE SYNTH ERROR]', err);
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[PARO VOICE SPEAK EXCEPTION]', err.message);
      if (onEnd) onEnd();
    }
  }

  stopSpeaking() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (err) {}
    }
  }

  previewParoVoice(sampleText) {
    const sample = sampleText || "हाँ नितिन, मैं PARO हूँ! बताओ, कौन सा गाना बजाऊँ?";
    this.speak(sample);
  }
}

export const voiceService = new VoiceService();
export default voiceService;
