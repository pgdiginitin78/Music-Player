import speech_recognition as sr
import logging

logger = logging.getLogger("PARO_STT")

class SpeechToTextService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.7

    def listen_and_recognize(self, timeout=4, phrase_time_limit=6):
        """
        Captures audio from default Windows microphone, returns (text, raw_pcm_bytes).
        """
        try:
            with sr.Microphone() as source:
                logger.info("Listening to Windows microphone...")
                self.recognizer.adjust_for_ambient_noise(source, duration=0.2)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
                
                raw_pcm = audio.get_raw_data(convert_rate=16000, convert_width=2)
                
                logger.info("Audio captured, performing speech-to-text...")
                try:
                    text = self.recognizer.recognize_google(audio)
                    logger.info(f"STT Transcript: '{text}'")
                    return text.strip(), raw_pcm
                except (sr.UnknownValueError, sr.RequestError):
                    return None, raw_pcm

        except sr.WaitTimeoutError:
            logger.info("Silence detected (no speech during timeout period).")
            return None, None
        except Exception as e:
            logger.error(f"Microphone capture error: {e}")
            return None, None

stt_service = SpeechToTextService()
