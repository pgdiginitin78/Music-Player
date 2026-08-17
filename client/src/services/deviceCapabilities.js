/**
 * Central Device Capabilities & Platform Detector
 * Robust, cross-browser detection layer for iOS, Safari, Chrome/Edge/Firefox on iOS,
 * PWA standalone mode, Web Speech API, Media Session API, and Secure Contexts.
 */

export const isIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS13Plus =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOS13Plus;
})();

export const isStandalonePWA = (() => {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = window.matchMedia
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const isNavStandalone = window.navigator && window.navigator.standalone === true;
  return Boolean(isDisplayStandalone || isNavStandalone);
})();

export const isSecureContext = (() => {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext === true;
})();

export const isSafari = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/i.test(ua);
})();

export const isChromeIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  return /CriOS/i.test(navigator.userAgent || '');
})();

export const isEdgeIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  return /EdgiOS/i.test(navigator.userAgent || '');
})();

export const isFirefoxIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  return /FxiOS/i.test(navigator.userAgent || '');
})();

export const supportsSpeechRecognition = (() => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
})();

export const SpeechRecognitionClass = (() => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
})();

export const supportsMicrophone = (() => {
  if (typeof navigator === 'undefined') return false;
  return Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
})();

export const supportsMediaSession = (() => {
  if (typeof navigator === 'undefined') return false;
  return 'mediaSession' in navigator;
})();

/**
 * On iOS (Safari, Chrome on iOS, Edge on iOS, Firefox on iOS), WebKit handles
 * SpeechRecognition by terminating long-running idle sessions and restricting
 * background microphone polling. Therefore, continuous "Hey Paro" wake-word polling
 * is unsupported on iOS, and PARO gracefully falls back to User-Activated Tap-to-Talk.
 */
export const supportsContinuousWakeWord = (() => {
  return !isIOS && supportsSpeechRecognition;
})();

/**
 * Generates structured diagnostic information for developer debugging.
 */
export function getParoDiagnostics() {
  return {
    platform: isIOS ? 'iOS / iPadOS' : 'Desktop / Android',
    isIOS,
    isSafari,
    isChromeIOS,
    isEdgeIOS,
    isFirefoxIOS,
    isPWA: isStandalonePWA,
    isSecureContext,
    microphoneAvailable: supportsMicrophone ? 'Available' : 'Unavailable',
    speechRecognitionSupported: supportsSpeechRecognition ? 'Supported' : 'Unavailable',
    speechRecognitionEngine: SpeechRecognitionClass
      ? SpeechRecognitionClass.name || 'SpeechRecognition'
      : 'None',
    mediaSessionSupported: supportsMediaSession ? 'Supported' : 'Unavailable',
    wakeWordMode: supportsContinuousWakeWord ? 'Continuous "Hey Paro" Active' : 'Unsupported on iOS WebKit',
    interactionMode: supportsContinuousWakeWord ? 'Wake Word + Tap-to-Talk' : 'User-Activated Tap-to-Talk Fallback',
    backgroundAudioSupport: 'Platform Dependent (HTMLAudio / MediaSession Enabled)',
  };
}

export default {
  isIOS,
  isSafari,
  isChromeIOS,
  isEdgeIOS,
  isFirefoxIOS,
  isStandalonePWA,
  isSecureContext,
  supportsSpeechRecognition,
  SpeechRecognitionClass,
  supportsMicrophone,
  supportsMediaSession,
  supportsContinuousWakeWord,
  getParoDiagnostics,
};
