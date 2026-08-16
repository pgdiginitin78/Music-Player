from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from collections import defaultdict

class TrendEngine:
    """
    Analyzes anonymous aggregate rolling windows (1h, 6h, 12h, 24h, 3d, 7d, 30d).
    Calculates current popularity score and growth rate without exposing individual user data.
    """

    def calculate_rolling_metrics(
        self, play_events: List[Dict[str, Any]], now: datetime = None
    ) -> Dict[str, Dict[str, float]]:
        if now is None:
            now = datetime.now(timezone.utc)

        windows = defaultdict(lambda: {"1h": 0, "6h": 0, "12h": 0, "24h": 0, "prev_6h": 0, "prev_24h": 0})

        t_1h = now - timedelta(hours=1)
        t_6h = now - timedelta(hours=6)
        t_12h = now - timedelta(hours=12)
        t_24h = now - timedelta(hours=24)
        t_48h = now - timedelta(hours=48)

        for event in play_events:
            song_id = event.get("youtubeVideoId") or event.get("songId") or event.get("song_id")
            if not song_id:
                continue

            ts_val = event.get("timestamp") or event.get("createdAt")
            if not ts_val:
                continue

            try:
                if isinstance(ts_val, str):
                    ts = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                else:
                    ts = ts_val
            except Exception:
                continue

            if ts >= t_1h:
                windows[song_id]["1h"] += 1
            if ts >= t_6h:
                windows[song_id]["6h"] += 1
            elif ts >= t_12h:
                windows[song_id]["prev_6h"] += 1

            if ts >= t_24h:
                windows[song_id]["24h"] += 1
            elif ts >= t_48h:
                windows[song_id]["prev_24h"] += 1

        results = {}
        for song_id, w in windows.items():
            recent_growth = w["6h"]
            prev_growth = w["prev_6h"]
            velocity = recent_growth / 6.0
            accel = (recent_growth - prev_growth) / 6.0

            results[song_id] = {
                "current_pop_score": min(1.0, w["24h"] / 25.0),
                "velocity": velocity,
                "acceleration": accel,
                "plays_24h": w["24h"],
                "plays_1h": w["1h"],
            }

        return results
