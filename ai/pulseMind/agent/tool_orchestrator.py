from typing import Dict, Any, List

class ToolOrchestrator:
    """
    Orchestrates tool selection and generates natural conversational responses.
    Prevents hallucination by relying strictly on verified catalog/recommendation tool calls.
    """

    @staticmethod
    def orchestrate_actions(
        resolved_intent: Dict[str, Any], player_state: Dict[str, Any] = None
    ) -> tuple[str, List[Dict[str, Any]]]:
        intent_type = resolved_intent.get("intent", "play_music")
        action_type = resolved_intent.get("action")
        mood = resolved_intent.get("mood")
        lang = resolved_intent.get("language")
        artist = resolved_intent.get("artist")
        energy = resolved_intent.get("energy")

        actions = []
        reply = "I've got you. Playing music for you."

        if intent_type == "control_player" and action_type:
            if action_type == "pause":
                reply = "Paused playback."
                actions.append({"type": "PAUSE_SONG"})
            elif action_type == "play":
                reply = "Resuming playback."
                actions.append({"type": "RESUME_SONG"})
            elif action_type == "skip":
                reply = "Skipped to next track."
                actions.append({"type": "SKIP_SONG"})
            elif action_type == "previous":
                reply = "Playing previous track."
                actions.append({"type": "PREVIOUS_SONG"})
        elif intent_type == "get_trending":
            reply = "Here are the top trending songs gaining momentum right now."
            actions.append({
                "type": "PLAY_RECOMMENDED_QUEUE",
                "mode": "trending",
                "params": {"language": lang, "mood": mood}
            })
        elif intent_type == "get_fresh":
            reply = "Playing fresh new releases for you."
            actions.append({
                "type": "PLAY_RECOMMENDED_QUEUE",
                "mode": "new",
                "params": {"language": lang, "mood": mood}
            })
        elif artist:
            reply = f"Playing songs by {artist}."
            actions.append({
                "type": "SEARCH_AND_PLAY",
                "params": {"query": artist, "artist": artist, "language": lang}
            })
        elif mood or lang or energy:
            descriptors = []
            if lang: descriptors.append(lang)
            if mood: descriptors.append(mood)
            if energy == "high": descriptors.append("higher energy")
            desc_str = " ".join(descriptors) if descriptors else "personalized"

            reply = f"Starting a {desc_str} mix for you."
            actions.append({
                "type": "PLAY_RECOMMENDED_QUEUE",
                "mode": "for-you",
                "params": {"language": lang, "mood": mood, "energy": energy}
            })
        else:
            reply = "Got you. Starting a personalized mix based on your taste."
            actions.append({
                "type": "PLAY_RECOMMENDED_QUEUE",
                "mode": "for-you",
                "params": {}
            })

        return reply, actions
