from collections import Counter
from typing import Dict, Any, List
from datetime import datetime

class UserTasteEngine:
    """
    Builds and continuously updates an isolated User Taste Profile vector.
    Calculates numerical affinities for artists, genres, languages, moods, energy,
    tempo, and time of day based strictly on the authenticated user's events.
    """

    def __init__(self, user_id: str, existing_profile: Dict[str, Any] = None):
        self.user_id = user_id
        self.artist_affinities = Counter(existing_profile.get("artistAffinities", {})) if existing_profile else Counter()
        self.genre_affinities = Counter(existing_profile.get("genreAffinities", {})) if existing_profile else Counter()
        self.language_affinities = Counter(existing_profile.get("languageAffinities", {})) if existing_profile else Counter()
        self.mood_affinities = Counter(existing_profile.get("moodAffinities", {})) if existing_profile else Counter()
        self.preferred_energy = existing_profile.get("preferredEnergy", 0.65) if existing_profile else 0.65
        self.preferred_tempo = existing_profile.get("preferredTempo", 110) if existing_profile else 110
        self.negative_preferences = existing_profile.get("negativePreferences", {}) if existing_profile else {"artists": [], "genres": [], "languages": [], "moods": []}

    def update_from_events(self, events: List[Dict[str, Any]], liked_song_ids: List[str]):
        """
        Updates affinities incrementally based on user interaction events.
        """
        liked_set = set(liked_song_ids)

        for event in events:
            artist = event.get("artist", "").strip()
            genre = event.get("category") or event.get("genre", "").strip()
            lang = event.get("language", "").strip() or "Hindi"
            event_type = event.get("eventType") or event.get("event", "play")
            ratio = float(event.get("completionRatio", 1.0))
            skipped = event.get("skipped", False)

            weight = 1.0
            if skipped or ratio < 0.2:
                weight = -0.5
            elif ratio > 0.8:
                weight = 1.5
            elif event_type == "replay":
                weight = 3.0
            elif event_type == "like":
                weight = 2.5

            if artist and artist not in self.negative_preferences.get("artists", []):
                self.artist_affinities[artist] = max(0.0, self.artist_affinities[artist] + weight)

            if genre and genre not in self.negative_preferences.get("genres", []):
                self.genre_affinities[genre] = max(0.0, self.genre_affinities[genre] + weight)

            if lang:
                self.language_affinities[lang] = max(0.0, self.language_affinities[lang] + weight)

    def calculate_taste_score(self, song: Dict[str, Any], is_liked: bool = False) -> float:
        """
        Calculates User Taste Affinity score (0.0 to 1.0) for a target song.
        """
        artist = song.get("artist", "").strip()
        genre = song.get("category") or song.get("genre", "").strip()
        lang = song.get("language", "Hindi")
        mood = song.get("mood", "romantic")

        # Check negative preferences first
        if artist in self.negative_preferences.get("artists", []):
            return 0.0
        if genre in self.negative_preferences.get("genres", []):
            return 0.0

        score = 0.0

        # Explicit Like (+0.40)
        if is_liked:
            score += 0.40

        # Artist Affinity (+0.30 max)
        if artist in self.artist_affinities:
            count = self.artist_affinities[artist]
            score += min(0.30, count * 0.05)

        # Genre Affinity (+0.15 max)
        if genre in self.genre_affinities:
            count = self.genre_affinities[genre]
            score += min(0.15, count * 0.03)

        # Language Affinity (+0.15 max)
        if lang in self.language_affinities:
            count = self.language_affinities[lang]
            score += min(0.15, count * 0.03)

        return round(min(1.0, score), 4)

    def export_profile(self) -> Dict[str, Any]:
        """Returns structured JSON representation of User Taste Profile."""
        return {
            "userId": self.user_id,
            "artistAffinities": dict(self.artist_affinities.most_common(10)),
            "genreAffinities": dict(self.genre_affinities.most_common(10)),
            "languageAffinities": dict(self.language_affinities.most_common(5)),
            "preferredEnergy": self.preferred_energy,
            "preferredTempo": self.preferred_tempo,
            "negativePreferences": self.negative_preferences,
        }
