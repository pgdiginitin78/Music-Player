import os

class Config:
    HOST = "127.0.0.1"
    PORT = 5050
    SAMPLE_RATE = 16000
    CHANNELS = 1
    CHUNK_SIZE = 1024
    
    # Wake Word Configuration
    WAKE_PHRASES = ["hey paro", "hi paro", "hello paro", "hey pero", "hey paroh", "paro"]
    
    # Text-To-Speech Configuration
    PARO_TTS_PROVIDER = os.getenv("PARO_TTS_PROVIDER", "edge-tts") # edge-tts | pyttsx3 | gtts
    PARO_TTS_VOICE = os.getenv("PARO_TTS_VOICE", "en-US-AvaNeural") # Natural soft female neural voices: Ava, Emma, Aria, Jenny, Neerja
    PARO_TTS_LANGUAGE = os.getenv("PARO_TTS_LANGUAGE", "en-US")
    PARO_TTS_SPEED = float(os.getenv("PARO_TTS_SPEED", "0.93"))  # Slightly slower conversational speed
    PARO_TTS_VOLUME = float(os.getenv("PARO_TTS_VOLUME", "0.90"))
    PARO_TTS_PITCH = os.getenv("PARO_TTS_PITCH", "+0Hz")

    # Preferred Local Female Voice Fallbacks
    FEMALE_VOICE_PREFERRED = [
        "en-US-AvaNeural",
        "en-US-EmmaNeural",
        "en-US-AriaNeural",
        "en-US-JennyNeural",
        "en-IN-NeerjaNeural",
        "zira",
        "samantha",
        "karen",
        "female"
    ]
