import numpy as np

class VoiceActivityDetector:
    def __init__(self, energy_threshold=300):
        self.energy_threshold = energy_threshold

    def get_audio_level(self, audio_data) -> tuple[float, bool]:
        """
        Returns normalized audio level (0-100%) and boolean is_speech.
        """
        if audio_data is None or len(audio_data) == 0:
            return 0.0, False
        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
            if len(audio_array) == 0:
                return 0.0, False

            rms = np.sqrt(np.mean(audio_array ** 2))
            # Normalize RMS to 0-100% (assuming max practical RMS ~ 3000)
            level = min(100.0, (rms / 3000.0) * 100.0)
            is_speech = rms > self.energy_threshold

            return round(level, 1), is_speech
        except Exception:
            return 0.0, False

vad_detector = VoiceActivityDetector()
