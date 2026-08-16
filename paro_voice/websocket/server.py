import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from speech.stt import stt_service
from wake.detector import wake_detector
from voice.tts import tts_service
from audio.vad import vad_detector
from audio.clap import clap_detector

logger = logging.getLogger("PARO_WS")

class WebSocketManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.is_running = False
        self.loop_task = None
        self.state = "IDLE"  # IDLE, WAKE_LISTENING, WAKE_DETECTED, COMMAND_LISTENING, PROCESSING, SPEAKING

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"React client connected to WebSocket. Total: {len(self.active_connections)}")
        await self.send_event(websocket, {"type": "voice_status", "state": "WAKE_LISTENING"})
        
        if not self.is_running:
            self.is_running = True
            self.loop_task = asyncio.create_task(self.background_voice_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"React client disconnected. Remaining: {len(self.active_connections)}")
        if len(self.active_connections) == 0:
            self.is_running = False

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")

    async def send_event(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending event: {e}")

    async def background_voice_loop(self):
        """
        Continuous background voice loop running on Python server.
        """
        logger.info("[PARO PYTHON VOICE LOOP] Started continuous background listener.")
        
        while self.is_running and len(self.active_connections) > 0:
            try:
                self.state = "WAKE_LISTENING"
                await self.broadcast({"type": "voice_status", "state": "WAKE_LISTENING"})

                # Run blocking speech recognition in threadpool executor
                loop = asyncio.get_event_loop()
                raw_text, raw_pcm = await loop.run_in_executor(None, stt_service.listen_and_recognize, 3, 5)

                # Process audio level & VAD
                audio_level, is_speech = vad_detector.get_audio_level(raw_pcm)
                is_clap = clap_detector.is_clap(raw_pcm)

                await self.broadcast({
                    "type": "audio_metrics",
                    "audioLevel": audio_level,
                    "vad": is_speech,
                    "clap": is_clap
                })

                if is_clap:
                    logger.info("[PARO CLAP DETECTED] High energy transient audio spike detected!")
                    self.state = "WAKE_DETECTED"
                    await self.broadcast({"type": "clap_detected", "audioLevel": audio_level})
                    await loop.run_in_executor(None, tts_service.speak, "Yes?")
                    self.state = "COMMAND_LISTENING"
                    await self.broadcast({"type": "voice_status", "state": "COMMAND_LISTENING"})
                    
                    cmd_text, _ = await loop.run_in_executor(None, stt_service.listen_and_recognize, 5, 7)
                    if cmd_text:
                        logger.info(f"[PARO CLAP COMMAND] Transcript: '{cmd_text}'")
                        self.state = "PROCESSING"
                        await self.broadcast({"type": "voice_status", "state": "PROCESSING"})
                        await self.broadcast({"type": "transcript", "text": cmd_text})
                    continue

                if not raw_text:
                    await self.broadcast({"type": "no_speech", "audioLevel": audio_level})
                    await asyncio.sleep(0.2)
                    continue

                logger.info(f"[PARO VOICE INPUT] Raw speech: '{raw_text}' (audio level: {audio_level}%)")
                await self.broadcast({"type": "raw_speech", "text": raw_text, "audioLevel": audio_level})

                # Check for wake word
                is_wake, extracted_command = wake_detector.check_wake_word(raw_text)

                if is_wake:
                    logger.info(f"[PARO WAKE DETECTED] Phrase: '{raw_text}'")
                    self.state = "WAKE_DETECTED"
                    await self.broadcast({"type": "wake_detected", "phrase": "hey paro", "raw": raw_text})

                    if extracted_command:
                        # Combined phrase like "Hey PARO, play Believer"
                        logger.info(f"[PARO COMBINED COMMAND] Command: '{extracted_command}'")
                        self.state = "PROCESSING"
                        await self.broadcast({"type": "voice_status", "state": "PROCESSING"})
                        await self.broadcast({"type": "transcript", "text": extracted_command})
                    else:
                        # Single wake phrase ("Hey PARO") -> Speak "Yes?" and listen for command
                        self.state = "SPEAKING"
                        await self.broadcast({"type": "voice_status", "state": "SPEAKING"})
                        
                        # TTS "Yes?" (microphone paused during TTS)
                        await loop.run_in_executor(None, tts_service.speak, "Yes?")
                        
                        self.state = "COMMAND_LISTENING"
                        await self.broadcast({"type": "voice_status", "state": "COMMAND_LISTENING"})

                        cmd_text, _ = await loop.run_in_executor(None, stt_service.listen_and_recognize, 5, 7)
                        
                        if cmd_text:
                            logger.info(f"[PARO COMMAND RECEIVED] '{cmd_text}'")
                            self.state = "PROCESSING"
                            await self.broadcast({"type": "voice_status", "state": "PROCESSING"})
                            await self.broadcast({"type": "transcript", "text": cmd_text})
                        else:
                            logger.info("[PARO COMMAND TIMEOUT] No command received after wake prompt.")
                            await self.broadcast({"type": "command_timeout"})
                else:
                    # Direct transcript
                    await self.broadcast({"type": "transcript", "text": raw_text})

                await asyncio.sleep(0.3)
            except Exception as e:
                logger.error(f"[PARO VOICE LOOP EXCEPTION] {e}")
                await self.broadcast({"type": "error", "message": str(e)})
                await asyncio.sleep(1.0)

ws_manager = WebSocketManager()
