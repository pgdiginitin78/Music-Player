import os
import asyncio
import tempfile
import logging
from pathlib import Path
from config import Config

logger = logging.getLogger("PARO_NEURAL_TTS")

class NeuralTextToSpeechService:
    def __init__(self):
        self.voice_name = Config.PARO_TTS_VOICE
        self.rate_str = f"{int((Config.PARO_TTS_SPEED - 1.0) * 100):+d}%"
        self.volume_str = f"{int((Config.PARO_TTS_VOLUME - 1.0) * 100):+d}%"
        self.cache_dir = Path(tempfile.gettempdir()) / "paro_tts_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.has_edge_tts = False
        self.fallback_engine = None

        self._check_providers()

    def _check_providers(self):
        try:
            import edge_tts
            self.has_edge_tts = True
            logger.info(f"Loaded Edge Neural TTS engine with voice '{self.voice_name}'")
        except ImportError:
            logger.warning("edge-tts package not installed. Initializing fallback pyttsx3 SAPI5 engine.")
            self._init_pyttsx3()

    def _init_pyttsx3(self):
        try:
            import pyttsx3
            self.fallback_engine = pyttsx3.init()
            self.fallback_engine.setProperty('rate', int(Config.PARO_TTS_SPEED * 175))
            voices = self.fallback_engine.getProperty('voices')
            for v in voices:
                v_name = v.name.lower()
                for pref in Config.FEMALE_VOICE_PREFERRED:
                    if pref.lower() in v_name:
                        self.fallback_engine.setProperty('voice', v.id)
                        logger.info(f"Fallback pyttsx3 voice set to: {v.name}")
                        break
        except Exception as e:
            logger.error(f"Failed to initialize pyttsx3 fallback: {e}")

    async def generate_speech_audio(self, text: str) -> str:
        """
        Generates high-quality natural female neural audio file path.
        """
        if not text or not text.trim():
            return None

        clean_text = text.strip()
        cache_key = f"{self.voice_name}_{hash(clean_text)}.mp3"
        cache_path = self.cache_dir / cache_key

        if cache_path.exists():
            return str(cache_path)

        if self.has_edge_tts:
            try:
                import edge_tts
                communicate = edge_tts.Communicate(
                    text=clean_text,
                    voice=self.voice_name,
                    rate=self.rate_str,
                    volume=self.volume_str
                )
                await communicate.save(str(cache_path))
                logger.info(f"Generated Edge Neural TTS audio for: '{clean_text}'")
                return str(cache_path)
            except Exception as e:
                logger.warn(f"Edge TTS generation failed ({e}). Trying fallback...")

        return None

    def speak(self, text: str):
        """
        Synchronous speak interface for PARO voice microservice.
        """
        if not text or not text.strip():
            return

        clean_text = text.strip()
        logger.info(f"PARO Neural TTS Speaking: '{clean_text}'")

        if self.has_edge_tts:
            try:
                import playsound
                audio_path = asyncio.run(self.generate_speech_audio(clean_text))
                if audio_path and os.path.exists(audio_path):
                    playsound.playsound(audio_path)
                    return
            except Exception as e:
                logger.warn(f"Audio playback exception ({e}). Falling back to system TTS...")

        if self.fallback_engine:
            try:
                self.fallback_engine.say(clean_text)
                self.fallback_engine.runAndWait()
            except Exception as e:
                logger.error(f"Fallback pyttsx3 error: {e}")

tts_service = NeuralTextToSpeechService()
