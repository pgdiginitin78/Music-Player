import re
from typing import Dict, Any, List

class FeatureExtractor:
    """
    Extracts and normalizes numerical and categorical song intelligence profiles
    and user event features. Handles missing metadata gracefully.
    """

    @staticmethod
    def normalize_tempo(bpm: float) -> float:
        """Normalizes BPM to a 0.0 - 1.0 scale (typical range 60 - 180 BPM)."""
        if not bpm:
            return 0.5
        return max(0.0, min(1.0, (float(bpm) - 60.0) / 120.0))

    @staticmethod
    def extract_song_features(song: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts song feature dictionary.
        """
        title = song.get("title", "").strip()
        artist = song.get("artist", "").strip()
        category = song.get("category", "").strip()

        # Deduce language/genre from title or category if missing
        language = song.get("language")
        if not language:
            title_lower = title.lower()
            if any(kw in title_lower for kw in ["hindi", "arijit", "bollywood", "song", "shreya", "dil", "pyar", "ishq"]):
                language = "Hindi"
            elif any(kw in title_lower for kw in ["punjabi", "sidhu", "ap dhillon", "diljit"]):
                language = "Punjabi"
            elif any(kw in title_lower for kw in ["english", "taylor", "drake", "pop", "remix"]):
                language = "English"
            else:
                language = "Hindi"

        genre = category or "Bollywood"
        
        # Deduce acoustic parameters safely or provide intelligent defaults
        energy = float(song.get("energy", 0.65))
        tempo = float(song.get("tempo", song.get("bpm", 110)))
        valence = float(song.get("valence", 0.60))
        danceability = float(song.get("danceability", 0.65))
        acousticness = float(song.get("acousticness", 0.30))

        return {
            "song_id": song.get("youtubeVideoId") or song.get("id") or song.get("_id"),
            "title": title,
            "artist": artist,
            "category": category,
            "language": language,
            "genre": genre,
            "energy": energy,
            "tempo": tempo,
            "norm_tempo": FeatureExtractor.normalize_tempo(tempo),
            "valence": valence,
            "danceability": danceability,
            "acousticness": acousticness,
            "release_date": song.get("releaseDate") or song.get("createdAt") or "",
        }
