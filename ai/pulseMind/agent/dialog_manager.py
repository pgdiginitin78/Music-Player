from typing import Dict, Any

class DialogManager:
    """
    Manages session conversation memory across turns.
    Preserves active intent constraints while applying updates or overrides.
    Resolves contextual pronouns using current player state.
    """

    def __init__(self, session_context: Dict[str, Any] = None):
        self.session_context = session_context or {
            "active_mood": None,
            "active_genre": None,
            "active_language": None,
            "active_artist": None,
            "active_energy": None,
            "active_tempo": None,
            "negative_preferences": {"artists": [], "moods": [], "languages": []},
            "history": []
        }

    def update_and_resolve_intent(
        self, new_intent: Dict[str, Any], player_state: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        resolved_intent = dict(new_intent)

        # Apply multi-turn context inheritance
        if new_intent.get("mood"):
            self.session_context["active_mood"] = new_intent["mood"]
        elif self.session_context.get("active_mood"):
            resolved_intent["mood"] = self.session_context["active_mood"]

        if new_intent.get("language"):
            self.session_context["active_language"] = new_intent["language"]
        elif self.session_context.get("active_language"):
            resolved_intent["language"] = self.session_context["active_language"]

        if new_intent.get("energy"):
            self.session_context["active_energy"] = new_intent["energy"]
        elif self.session_context.get("active_energy"):
            resolved_intent["energy"] = self.session_context["active_energy"]

        if new_intent.get("artist"):
            self.session_context["active_artist"] = new_intent["artist"]

        # Merge negative preferences
        neg = new_intent.get("negativePreferences", {})
        for mood in neg.get("moods", []):
            if mood not in self.session_context["negative_preferences"]["moods"]:
                self.session_context["negative_preferences"]["moods"].append(mood)

        resolved_intent["negativePreferences"] = self.session_context["negative_preferences"]

        # Contextual resolution for "this song" or "similar to current"
        if resolved_intent.get("similarToCurrent") and player_state and player_state.get("currentSong"):
            curr = player_state["currentSong"]
            resolved_intent["artist"] = curr.get("artist")
            resolved_intent["genre"] = curr.get("category")

        return resolved_intent

    def export_session(self) -> Dict[str, Any]:
        return self.session_context
