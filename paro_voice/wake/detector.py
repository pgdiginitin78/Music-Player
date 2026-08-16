import re
from config import Config

class WakeWordDetector:
    def __init__(self):
        self.wake_phrases = Config.WAKE_PHRASES
        self.pattern = re.compile(r'\b(hey|hi|hello)?\s*(paro|pero|paroh)\b', re.IGNORECASE)

    def check_wake_word(self, text: str) -> tuple[bool, str]:
        if not text:
            return False, ""
        
        match = self.pattern.search(text)
        if match:
            # Extract remaining text after wake word (e.g. "play ehsass" from "Hey PARO play ehsass")
            command = text[match.end():].strip()
            command = re.sub(r'^[\s,\.\-]+', '', command)
            return True, command
        return False, ""

wake_detector = WakeWordDetector()
