import sys
import os
import argparse
import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import Config
from speech.stt import stt_service
from wake.detector import wake_detector
from voice.tts import tts_service
from websocket.server import ws_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("PARO_VOICE_SERVICE")

app = FastAPI(title="PARO Python Voice Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "paro-voice", "version": "1.0.0"}

@app.get("/device-id")
def get_device_id():
    import uuid
    mac_num = uuid.getnode()
    mac_hex = f"{mac_num:012x}"
    return {
        "status": "ok",
        "macAddress": f"mac_{mac_hex}",
        "source": "PYTHON_LOCAL_HARDWARE",
        "scope": "PHYSICAL_DEVICE"
    }

@app.get("/status")
def status_check():
    return {
        "status": "ok",
        "service": "paro-voice",
        "state": ws_manager.state,
        "connections": len(ws_manager.active_connections),
        "microphone": "AVAILABLE",
        "permission": "GRANTED",
    }

@app.post("/voice/tts")
def speak_text(req: TTSRequest):
    if req.text:
        tts_service.speak(req.text)
        return {"success": True, "text": req.text}
    return {"success": False, "error": "No text provided"}

@app.websocket("/ws/paro")
async def paro_ws(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received WS payload from React: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

def run_test_microphone():
    print("\n--- TEST MICROPHONE ---")
    print("Testing Windows default microphone capture...")
    text = stt_service.listen_and_recognize(timeout=5, phrase_time_limit=5)
    if text:
        print(f"SUCCESS! Microphone captured speech: '{text}'")
    else:
        print("RESULT: No speech detected or timeout.")

def run_test_wake():
    print("\n--- TEST WAKE WORD ---")
    print("Say 'Hey PARO' into your Windows microphone...")
    text = stt_service.listen_and_recognize(timeout=6, phrase_time_limit=5)
    if text:
        print(f"Captured: '{text}'")
        is_wake, cmd = wake_detector.check_wake_word(text)
        if is_wake:
            print(f"SUCCESS! WAKE DETECTED! Phrase: '{text}', Command: '{cmd}'")
            tts_service.speak("Yes?")
        else:
            print(f"Phrase '{text}' did not match wake word 'Hey PARO'.")
    else:
        print("RESULT: No speech detected.")

def run_test_speech():
    print("\n--- TEST SPEECH TRANSCRIPTION ---")
    print("Speak a command into your Windows microphone (e.g. 'Play Ehsass')...")
    text = stt_service.listen_and_recognize(timeout=6, phrase_time_limit=8)
    if text:
        print(f"TRANSCRIPT: '{text}'")
        tts_service.speak(f"You said: {text}")
    else:
        print("RESULT: Speech not recognized.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PARO Python Voice Microservice")
    parser.add_argument("--test-microphone", action="store_true", help="Test Windows default microphone")
    parser.add_argument("--test-wake", action="store_true", help="Test 'Hey PARO' wake word detection")
    parser.add_argument("--test-speech", action="store_true", help="Test speech-to-text command recognition")
    args = parser.parse_args()

    if args.test_microphone:
        run_test_microphone()
    elif args.test_wake:
        run_test_wake()
    elif args.test_speech:
        run_test_speech()
    else:
        import uvicorn
        logger.info(f"Starting PARO Python Voice Service on http://{Config.HOST}:{Config.PORT}")
        uvicorn.run(app, host=Config.HOST, port=Config.PORT)
