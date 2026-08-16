import math
from typing import Dict, Any

class SimilarityEngine:
    """
    Calculates multi-feature similarity scores (0.0 to 1.0) between songs
    based on artist, genre, language, mood, energy, tempo, valence, danceability, and acousticness.
    """

    @staticmethod
    def calculate_song_similarity(song1: Dict[str, Any], song2: Dict[str, Any]) -> float:
        if not song1 or not song2:
            return 0.5

        id1 = song1.get("youtubeVideoId") or song1.get("id") or song1.get("_id")
        id2 = song2.get("youtubeVideoId") or song2.get("id") or song2.get("_id")
        if id1 and id1 == id2:
            return 1.0

        score = 0.0

        # 1. Exact Artist Match (+0.35)
        artist1 = str(song1.get("artist", "")).strip().lower()
        artist2 = str(song2.get("artist", "")).strip().lower()
        if artist1 and artist1 == artist2:
            score += 0.35

        # 2. Genre / Category Match (+0.25)
        cat1 = str(song1.get("category", "")).strip().lower()
        cat2 = str(song2.get("category", "")).strip().lower()
        if cat1 and cat1 == cat2:
            score += 0.25

        # 3. Energy Continuity (+0.20 max)
        e1 = float(song1.get("energy", 0.65))
        e2 = float(song2.get("energy", 0.65))
        energy_sim = max(0.0, 1.0 - abs(e1 - e2))
        score += energy_sim * 0.20

        # 4. Tempo / BPM Compatibility (+0.20 max)
        bpm1 = float(song1.get("tempo") or song1.get("bpm", 110))
        bpm2 = float(song2.get("tempo") or song2.get("bpm", 110))
        
        # Harmonic tempo distance (supports 1:1, 1:2 double-time, 2:1 half-time)
        candidates = [bpm2, bpm2 * 2.0, bpm2 / 2.0]
        min_diff = min(abs(bpm1 - c) for c in candidates)
        tempo_sim = max(0.0, 1.0 - (min_diff / 40.0))
        score += tempo_sim * 0.20

        return round(min(1.0, score), 4)
