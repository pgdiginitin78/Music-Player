import time
import numpy as np

class ClapDetector:
    def __init__(self, spike_threshold=800, cooldown_sec=1.5):
        self.spike_threshold = spike_threshold
        self.cooldown_sec = cooldown_sec
        self.last_clap_time = 0

    def is_clap(self, audio_data) -> bool:
        if audio_data is None or len(audio_data) == 0:
            return False

        now = time.time()
        if now - self.last_clap_time < self.cooldown_sec:
            return False

        try:
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
            if len(audio_array) == 0:
                return False

            peak = np.max(np.abs(audio_array))
            rms = np.sqrt(np.mean(audio_array ** 2))
            crest_factor = peak / (rms + 1e-5)

            # A clap is a high peak with a sharp crest factor (> 3.5)
            if peak > self.spike_threshold and crest_factor > 3.5:
                self.last_clap_time = now
                return True
        except Exception:
            pass

        return False

clap_detector = ClapDetector()
