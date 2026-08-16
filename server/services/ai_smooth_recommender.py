import sys
import json
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

class AISmoothMusicRecommender:
    """
    AI Recommendation & Smooth Listening Engine in Python.
    
    1. Hybrid Recommendation Model:
       Combines User Liked Songs + Today's Time-Decayed Plays + Audio Feature Similarity.
       
    2. Smooth Transitions (Mood & Pace Continuity):
       Ranks upcoming queue tracks based on audio energy, tempo (BPM), and acoustic valence
       to ensure seamless, smooth song transitions without abrupt mood breaks.
    """

    def __init__(self, half_life_hours: float = 6.0):
        self.half_life_hours = half_life_hours

    def _normalize_tempo(self, bpm: float) -> float:
        """Normalizes BPM to a 0.0 - 1.0 scale (range: 60 - 180 BPM)."""
        return max(0.0, min(1.0, (bpm - 60.0) / 120.0))

    def calculate_smooth_transition_score(self, current_song: Dict[str, Any], candidate_song: Dict[str, Any]) -> float:
        """
        Calculates a Smoothness Score (0.0 to 1.0) between current song and candidate.
        Considers energy continuity, tempo compatibility, and genre/category harmony.
        """
        curr_energy = current_song.get("energy", 0.7)
        cand_energy = candidate_song.get("energy", 0.7)
        energy_diff = abs(curr_energy - cand_energy)

        curr_bpm = self._normalize_tempo(current_song.get("bpm", 110))
        cand_bpm = self._normalize_tempo(candidate_song.get("bpm", 110))
        tempo_diff = abs(curr_bpm - cand_bpm)

        same_category = 1.0 if current_song.get("category") == candidate_song.get("category") else 0.7

        # Smoothness decreases with large jumps in energy or tempo
        smoothness = (1.0 - (0.5 * energy_diff + 0.3 * tempo_diff)) * same_category
        return max(0.1, min(1.0, smoothness))

    def rank_for_you_songs(
        self,
        catalog: List[Dict[str, Any]],
        liked_song_ids: List[str],
        play_events: List[Dict[str, Any]],
        current_playing_song: Dict[str, Any] = None,
        top_n: int = 25
    ) -> List[Dict[str, Any]]:
        """
        AI Hybrid Recommendation Algorithm.
        """
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Build user liked set
        liked_set = set(liked_song_ids)

        # Aggregate today's time-decayed popularity
        today_play_scores = {}
        for event in play_events:
            ts_str = event.get("timestamp")
            if not ts_str:
                continue
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str

            if ts < today_start:
                continue

            song_id = event["song_id"]
            delta_hours = max(0.0, (now - ts).total_seconds() / 3600.0)
            time_decay_weight = math.pow(2, -delta_hours / self.half_life_hours)
            
            today_play_scores[song_id] = today_play_scores.get(song_id, 0.0) + time_decay_weight

        # Rank all catalog songs using AI scoring formula
        scored_songs = []
        for song in catalog:
            song_id = song.get("youtubeVideoId") or song.get("id") or song.get("_id")
            if not song_id:
                continue

            # 1. Liked Music Boost (Base + 2.5 multiplier)
            like_score = 2.5 if song_id in liked_set else 0.0

            # 2. Today's Time-Decayed Popularity Score
            popularity_score = today_play_scores.get(song_id, 0.0) * 0.8

            # 3. Audio Smoothness Score (if currently listening to a song)
            smooth_score = 0.0
            if current_playing_song:
                smooth_score = self.calculate_smooth_transition_score(current_playing_song, song) * 1.5

            # Total Hybrid Score
            total_score = round(like_score + popularity_score + smooth_score, 4)

            song_copy = dict(song)
            song_copy["ai_recommendation_score"] = total_score
            if song_id in liked_set:
                song_copy["is_liked"] = True

            scored_songs.append((total_score, song_copy))

        # Sort descending by total AI score
        scored_songs.sort(key=lambda x: x[0], reverse=True)

        return [song for score, song in scored_songs[:top_n]]


# -------------------------------------------------------------------------
# CLI JSON Interface for Node.js Integration
# -------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            input_json = sys.argv[1]
            data = json.loads(input_json)
        else:
            # Read from STDIN if passed via pipe
            raw_input = sys.stdin.read()
            data = json.loads(raw_input) if raw_input.trim() else {}

        catalog = data.get("catalog", [])
        liked_ids = data.get("liked_song_ids", [])
        events = data.get("play_events", [])
        current_song = data.get("current_playing_song", None)
        limit = data.get("top_n", 25)

        recommender = AISmoothMusicRecommender()
        results = recommender.rank_for_you_songs(catalog, liked_ids, events, current_song, limit)

        print(json.dumps({"success": True, "songs": results}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
