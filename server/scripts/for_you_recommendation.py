import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from collections import defaultdict

class TodayForYouRecommender:
    """
    AI Time-Decayed Ranking Algorithm for "For You" (Today's Most Played) Songs.
    
    Key Features:
    1. Strict Today Filter: Only processes play events from the current day (since 00:00:00 UTC).
    2. Exponential Time-Decay (AI Weighting): Recent plays today get exponentially higher weight
       using a half-life formula: Weight = 2^(-delta_t / half_life).
    3. User Diversity Guard: Diminishing returns for repetitive plays by the same user to prevent spam.
    4. Completion Quality: Plays completed to 100% are weighted higher than skipped tracks.
    """

    def __init__(self, half_life_hours: float = 6.0):
        """
        :param half_life_hours: Time in hours after which a play event's weight halves.
        """
        self.half_life_hours = half_life_hours

    def _is_today(self, event_time: datetime, now: datetime) -> bool:
        """Checks if the event timestamp belongs to today (calendar day or last 24h)."""
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return event_time >= today_start and event_time <= now

    def _calculate_time_decay_weight(self, event_time: datetime, now: datetime) -> float:
        """
        AI Exponential Decay Weighting:
        Weight = 2 ^ (-delta_hours / half_life)
        """
        delta_seconds = (now - event_time).total_seconds()
        delta_hours = max(0.0, delta_seconds / 3600.0)
        weight = math.pow(2, -delta_hours / self.half_life_hours)
        return weight

    def recommend_todays_top_songs(
        self,
        play_events: List[Dict[str, Any]],
        song_metadata: Dict[str, Dict[str, Any]],
        top_n: int = 10,
        now: datetime = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates today's top played "For You" songs.
        
        :param play_events: List of play events:
            [
                {
                    "song_id": "dTU413E74g0",
                    "user_id": "user_101",
                    "timestamp": "2026-08-16T14:30:00Z",
                    "duration_played_sec": 240,
                    "total_song_duration_sec": 240,
                    "skipped": False
                }, ...
            ]
        :param song_metadata: Dictionary of song details keyed by song_id
        :param top_n: Number of top songs to return
        :param now: Current reference time (defaults to datetime.now(timezone.utc))
        :return: Sorted list of "For You" recommended songs with scores and play statistics
        """
        if now is None:
            now = datetime.now(timezone.utc)

        # Structure to track scores and user play counts per song
        song_scores = defaultdict(float)
        song_user_play_counts = defaultdict(lambda: defaultdict(int))
        song_play_totals = defaultdict(int)
        song_unique_users = defaultdict(set)

        # Phase 1: Filter and Aggregate Events for Today
        for event in play_events:
            # Parse timestamp if string
            ts_val = event.get("timestamp")
            if isinstance(ts_val, str):
                # Handle ISO 8601 strings
                ts = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
            else:
                ts = ts_val

            # Skip events that are NOT from today
            if not self._is_today(ts, now):
                continue

            song_id = event["song_id"]
            user_id = event.get("user_id", "anonymous")
            duration_played = event.get("duration_played_sec", 0)
            total_duration = event.get("total_song_duration_sec", 210)
            skipped = event.get("skipped", False)

            # Skip ultra-short accidental clicks (< 15 seconds)
            if duration_played < 15 and skipped:
                continue

            # 1. AI Time Decay Weight (0.0 to 1.0)
            time_weight = self._calculate_time_decay_weight(ts, now)

            # 2. Completion Ratio Weight (0.1 to 1.0)
            completion_ratio = min(1.0, duration_played / max(1.0, total_duration))
            quality_multiplier = 0.2 if skipped else (0.5 + 0.5 * completion_ratio)

            # 3. User Spam Protection (Diminishing Returns per User)
            user_play_num = song_user_play_counts[song_id][user_id] + 1
            song_user_play_counts[song_id][user_id] = user_play_num
            user_diversity_factor = 1.0 / math.sqrt(user_play_num) # 1st play=1.0, 2nd=0.707, 4th=0.5

            # Calculate event score
            event_score = time_weight * quality_multiplier * user_diversity_factor
            song_scores[song_id] += event_score

            # Stats tracking
            song_play_totals[song_id] += 1
            song_unique_users[song_id].add(user_id)

        # Phase 2: Rank Songs by Final Score
        ranked_results = []
        for song_id, score in song_scores.items():
            meta = song_metadata.get(song_id, {
                "id": song_id,
                "title": f"Song {song_id}",
                "artist": "Unknown Artist",
                "coverImage": "/images/default-album.webp"
            })

            ranked_results.append({
                "song": meta,
                "score": round(score, 4),
                "todays_play_count": song_play_totals[song_id],
                "todays_unique_listeners": len(song_unique_users[song_id]),
                "category": "for-you"
            })

        # Sort descending by AI recommendation score
        ranked_results.sort(key=lambda x: x["score"], reverse=True)

        return ranked_results[:top_n]


# -------------------------------------------------------------------------
# Demonstration & Verification
# -------------------------------------------------------------------------
if __name__ == "__main__":
    now_utc = datetime.now(timezone.utc)
    
    # Sample Catalog
    catalog = {
        "dTU413E74g0": {"id": "dTU413E74g0", "title": "Kesariya", "artist": "Arijit Singh", "category": "for-you"},
        "V7LwfY5U_BU": {"id": "V7LwfY5U_BU", "title": "Apna Bana Le", "artist": "Arijit Singh", "category": "for-you"},
        "kY0a7L_n2i0": {"id": "kY0a7L_n2i0", "title": "Husn", "artist": "Anuv Jain", "category": "for-you"},
        "NbyHNASFi6U": {"id": "NbyHNASFi6U", "title": "Chaleya", "artist": "Arijit Singh", "category": "for-you"},
    }

    # Sample Log of Play Events Today
    sample_events = [
        # Recent plays today for Kesariya
        {"song_id": "dTU413E74g0", "user_id": "u1", "timestamp": (now_utc - timedelta(minutes=30)).isoformat(), "duration_played_sec": 240, "skipped": False},
        {"song_id": "dTU413E74g0", "user_id": "u2", "timestamp": (now_utc - timedelta(hours=1)).isoformat(), "duration_played_sec": 240, "skipped": False},
        {"song_id": "dTU413E74g0", "user_id": "u3", "timestamp": (now_utc - timedelta(hours=2)).isoformat(), "duration_played_sec": 200, "skipped": False},
        
        # Plays for Husn today
        {"song_id": "kY0a7L_n2i0", "user_id": "u4", "timestamp": (now_utc - timedelta(minutes=10)).isoformat(), "duration_played_sec": 218, "skipped": False},
        {"song_id": "kY0a7L_n2i0", "user_id": "u5", "timestamp": (now_utc - timedelta(minutes=45)).isoformat(), "duration_played_sec": 218, "skipped": False},

        # Play from YESTERDAY (should be excluded by algorithm)
        {"song_id": "V7LwfY5U_BU", "user_id": "u6", "timestamp": (now_utc - timedelta(days=2)).isoformat(), "duration_played_sec": 240, "skipped": False},
    ]

    recommender = TodayForYouRecommender(half_life_hours=6.0)
    top_for_you = recommender.recommend_todays_top_songs(sample_events, catalog, top_n=3, now=now_utc)

    print("=== Today's 'For You' AI Recommendations ===")
    for idx, item in enumerate(top_for_you, 1):
        print(f"{idx}. {item['song']['title']} by {item['song']['artist']}")
        print(f"   Score: {item['score']} | Plays Today: {item['todays_play_count']} | Listeners Today: {item['todays_unique_listeners']}\n")
