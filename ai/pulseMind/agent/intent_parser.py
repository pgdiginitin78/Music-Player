import re
from typing import Dict, Any
from ai.pulseMind.agent.mood_mapper import MoodMapper

class IntentParser:
    """
    Parses natural language user messages into structured MusicIntent representations:
    {
        "intent": "play_music" | "search_music" | "control_player" | "get_recommendations" | "get_trending" | "get_fresh" | "unknown",
        "action": "play" | "pause" | "skip" | "previous" | "set_volume" | "seek" | "add_to_queue" | "clear_queue" | null,
        "query": str | null,
        "artist": str | null,
        "genre": str | null,
        "language": str | null,
        "mood": str | null,
        "energy": str | null,
        "tempo": str | null,
        "freshness": str | null,
        "trending": bool,
        "similarToCurrent": bool,
        "discovery": bool,
        "negativePreferences": Dict[str, list],
        "count": int
    }
    """

    @staticmethod
    def parse_user_message(message: str, player_state: Dict[str, Any] = None) -> Dict[str, Any]:
        msg_lower = message.lower().strip()

        intent_data = {
            "intent": "play_music",
            "action": None,
            "query": None,
            "artist": None,
            "genre": None,
            "language": None,
            "mood": None,
            "energy": None,
            "tempo": None,
            "freshness": None,
            "trending": False,
            "similarToCurrent": False,
            "discovery": False,
            "negativePreferences": {"artists": [], "moods": [], "languages": []},
            "count": 10
        }

        # 1. Player Control Actions
        if any(kw in msg_lower for kw in ["pause", "stop music", "pause playback"]):
            intent_data["intent"] = "control_player"
            intent_data["action"] = "pause"
            return intent_data
        elif any(kw in msg_lower for kw in ["resume", "play music", "start playing"]) and len(msg_lower) < 15:
            intent_data["intent"] = "control_player"
            intent_data["action"] = "play"
            return intent_data
        elif any(kw in msg_lower for kw in ["next song", "skip this", "skip"]):
            intent_data["intent"] = "control_player"
            intent_data["action"] = "skip"
            return intent_data
        elif any(kw in msg_lower for kw in ["previous song", "go back"]):
            intent_data["intent"] = "control_player"
            intent_data["action"] = "previous"
            return intent_data

        # 2. Trending Requests
        if any(kw in msg_lower for kw in ["trending", "viral", "popular right now", "hottest songs"]):
            intent_data["trending"] = True
            intent_data["intent"] = "get_trending"

        # 3. Fresh / New Releases
        if any(kw in msg_lower for kw in ["new songs", "new releases", "latest", "just released", "fresh music"]):
            intent_data["freshness"] = "high"
            if intent_data["intent"] == "play_music":
                intent_data["intent"] = "get_fresh"

        # 4. Contextual Similarity ("songs like this", "similar to this", "more like the last one")
        if any(kw in msg_lower for kw in ["like this", "similar to this", "more like this", "more like the last"]):
            intent_data["similarToCurrent"] = True

        # 5. Language Detection
        if "hindi" in msg_lower:
            intent_data["language"] = "Hindi"
        elif "punjabi" in msg_lower:
            intent_data["language"] = "Punjabi"
        elif "english" in msg_lower:
            intent_data["language"] = "English"

        # 6. Emotion & Mood Extraction
        mapped_mood = MoodMapper.map_mood(msg_lower)
        if mapped_mood["mood"]:
            intent_data["mood"] = mapped_mood["mood"]
            intent_data["energy"] = mapped_mood["energy"]
            intent_data["tempo"] = mapped_mood["tempo"]

        # 7. Energy Modifiers ("more energetic", "faster", "slower", "chill")
        if "more energetic" in msg_lower or "higher energy" in msg_lower or "faster" in msg_lower:
            intent_data["energy"] = "high"
            intent_data["tempo"] = "fast"
        elif "slower" in msg_lower or "calmer" in msg_lower or "more chill" in msg_lower:
            intent_data["energy"] = "low"
            intent_data["tempo"] = "slow"

        # 8. Negative Preferences ("no sad songs", "don't play arijit", "nothing slow")
        if "no sad" in msg_lower or "don't play sad" in msg_lower:
            intent_data["negativePreferences"]["moods"].append("sad")
        if "don't play arijit" in msg_lower or "no arijit" in msg_lower:
            intent_data["negativePreferences"]["artists"].append("Arijit Singh")

        # 9. Artist Queries ("play arijit", "play kesariya", "find songs by anuv jain")
        artist_matches = re.search(r'(?:by|artist|play)\s+([a-zA-Z\s]+)', msg_lower)
        if artist_matches:
            potential_artist = artist_matches.group(1).strip()
            if potential_artist and potential_artist not in ["some", "new", "more", "like", "hindi", "romantic", "sad"]:
                intent_data["artist"] = potential_artist.title()
                intent_data["query"] = potential_artist.title()

        return intent_data
