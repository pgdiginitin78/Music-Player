import sys
import json
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple
from collections import defaultdict, Counter

# =============================================================================
# FRESHPULSE AI CONFIGURATION
# =============================================================================
DEFAULT_CONFIG = {
    # Ranking Feature Weights (Sum to 1.0)
    "weight_current_popularity": 0.25,
    "weight_momentum": 0.20,
    "weight_trend_acceleration": 0.15,
    "weight_user_taste": 0.15,
    "weight_freshness": 0.10,
    "weight_engagement_quality": 0.05,
    "weight_smooth_transition": 0.05,
    "weight_discovery": 0.05,

    # Decay & Penalty Constants
    "half_life_momentum_hours": 12.0,      # Momentum decay
    "half_life_repetition_hours": 2.0,       # Recent play penalty decay
    "max_songs_per_artist": 2,              # Diversity filter cap
}

# =============================================================================
# FRESHPULSE AI CORE ENGINE
# =============================================================================
class FreshPulseAI:
    """
    FreshPulse AI Engine:
    Prioritizes Currently Exploding, Fresh & Relevant Music over Lifetime Popularity.
    """

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or DEFAULT_CONFIG

    # -------------------------------------------------------------------------
    # 1. FRESHNESS ENGINE & AGE PENALTY
    # -------------------------------------------------------------------------
    def calculate_freshness_score(self, release_date_str: str, now: datetime) -> Tuple[float, float]:
        """
        Calculates Freshness Score (0.0 to 1.0) and Age Penalty (0.0 to 1.0).
        0-7 days: ~1.0 (extremely fresh)
        8-30 days: 0.85-0.95 (very fresh)
        31-60 days: 0.70-0.85 (fresh)
        61-90 days: 0.50-0.70 (moderate)
        91-180 days: 0.25-0.50 (low)
        180+ days: < 0.20 (heavily penalized)
        """
        if not release_date_str:
            return 0.4, 0.2  # Default neutral for unknown release dates

        try:
            rel_date = datetime.fromisoformat(release_date_str.replace("Z", "+00:00"))
            age_days = max(0.0, (now - rel_date).total_seconds() / 86400.0)
        except Exception:
            return 0.4, 0.2

        if age_days <= 7:
            freshness = 1.0
            penalty = 0.0
        elif age_days <= 30:
            freshness = 0.85 + (30 - age_days) / 23 * 0.15
            penalty = 0.05
        elif age_days <= 60:
            freshness = 0.70 + (60 - age_days) / 30 * 0.15
            penalty = 0.15
        elif age_days <= 180:
            freshness = 0.30 + (180 - age_days) / 120 * 0.40
            penalty = 0.35
        else:
            freshness = max(0.05, 0.30 * math.exp(-(age_days - 180) / 180.0))
            penalty = min(0.60, 0.35 + (age_days - 180) / 365.0 * 0.25)

        return round(freshness, 4), round(penalty, 4)

    # -------------------------------------------------------------------------
    # 2. TREND MOMENTUM & ACCELERATION ENGINE
    # -------------------------------------------------------------------------
    def calculate_trend_metrics(self, play_events: List[Dict[str, Any]], now: datetime) -> Dict[str, Dict[str, float]]:
        """
        Calculates Rolling Windows: 1h, 6h, 24h, 3d, 7d.
        Velocity = current growth rate.
        Acceleration = current growth rate - previous growth rate.
        Trend Explosion Score = combination of velocity + acceleration + recency.
        """
        song_windows = defaultdict(lambda: {"1h": 0, "6h": 0, "24h": 0, "prev_6h": 0, "prev_24h": 0})

        t_1h = now - timedelta(hours=1)
        t_6h = now - timedelta(hours=6)
        t_12h = now - timedelta(hours=12)
        t_24h = now - timedelta(hours=24)
        t_48h = now - timedelta(hours=48)

        for event in play_events:
            song_id = event.get("song_id")
            if not song_id:
                continue

            ts_str = event.get("timestamp")
            if not ts_str:
                continue

            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str
            except Exception:
                continue

            if ts >= t_1h:
                song_windows[song_id]["1h"] += 1
            if ts >= t_6h:
                song_windows[song_id]["6h"] += 1
            elif ts >= t_12h:
                song_windows[song_id]["prev_6h"] += 1

            if ts >= t_24h:
                song_windows[song_id]["24h"] += 1
            elif ts >= t_48h:
                song_windows[song_id]["prev_24h"] += 1

        results = {}
        for song_id, w in song_windows.items():
            recent_growth = w["6h"]
            prev_growth = w["prev_6h"]

            # Velocity (growth rate)
            velocity = recent_growth / 6.0

            # Trend Acceleration = current rate - previous rate
            acceleration = (recent_growth - prev_growth) / 6.0

            # Momentum Score (0.0 to 1.0)
            momentum_score = min(1.0, (w["1h"] * 3.0 + w["6h"] * 1.0) / 20.0)

            # Acceleration Score (0.0 to 1.0)
            accel_score = min(1.0, max(0.0, acceleration / 5.0))

            # Trend Explosion Score
            explosion_score = min(1.0, (momentum_score * 0.5 + accel_score * 0.5))

            results[song_id] = {
                "current_pop_score": min(1.0, w["24h"] / 30.0),
                "momentum_score": momentum_score,
                "acceleration_score": accel_score,
                "explosion_score": explosion_score,
                "plays_24h": w["24h"],
                "plays_1h": w["1h"],
            }

        return results

    # -------------------------------------------------------------------------
    # 3. ENGAGEMENT QUALITY & SKIP INTELLIGENCE
    # -------------------------------------------------------------------------
    def calculate_engagement_score(self, event: Dict[str, Any]) -> float:
        """
        Evaluates completion ratio & skip timing intelligence.
        Played < 3s: -0.8 (heavy skip penalty)
        Played < 20s: -0.4 (mild skip penalty)
        Played > 80%: +0.8 (strong positive)
        Played > 95%: +1.0 (completion peak)
        """
        duration = event.get("duration_played_sec", 0)
        total = max(1, event.get("total_song_duration_sec", 210))
        skipped = event.get("skipped", False)

        ratio = duration / total

        if skipped and duration < 3:
            return -0.8
        elif skipped and duration < 20:
            return -0.4
        elif ratio >= 0.95:
            return 1.0
        elif ratio >= 0.80:
            return 0.8
        elif ratio >= 0.50:
            return 0.4
        else:
            return 0.1

    # -------------------------------------------------------------------------
    # 4. BPM INTELLIGENCE & HARMONIC SMOOTHNESS
    # -------------------------------------------------------------------------
    def calculate_bpm_harmonic_match(self, bpm1: float, bpm2: float) -> float:
        """
        Handles musical BPM relationships:
        Absolute matching: 80 BPM vs 80 BPM
        Double-time: 80 BPM vs 160 BPM (Harmonic match!)
        Half-time: 160 BPM vs 80 BPM (Harmonic match!)
        """
        if not bpm1 or not bpm2:
            return 0.7  # Default safe smoothness

        candidates = [bpm2, bpm2 * 2.0, bpm2 / 2.0]
        min_diff = min(abs(bpm1 - c) for c in candidates)

        # Smoothness decay based on closest harmonic BPM difference
        smoothness = max(0.2, 1.0 - (min_diff / 40.0))
        return round(smoothness, 4)

    # -------------------------------------------------------------------------
    # 5. USER TASTE ENGINE
    # -------------------------------------------------------------------------
    def calculate_user_taste_score(
        self,
        song: Dict[str, Any],
        liked_set: set,
        artist_affinities: Counter,
        genre_affinities: Counter
    ) -> float:
        """
        Calculates User Taste Affinity based on Likes + Artist Listens + Genre Listens.
        """
        song_id = song.get("youtubeVideoId") or song.get("id") or song.get("_id")
        score = 0.0

        # Explicit Like (+0.50)
        if song_id in liked_set:
            score += 0.50

        # Artist Affinity (+0.30 max)
        artist = song.get("artist", "")
        if artist in artist_affinities:
            artist_count = artist_affinities[artist]
            score += min(0.30, artist_count * 0.05)

        # Genre Affinity (+0.20 max)
        genre = song.get("category", "")
        if genre in genre_affinities:
            genre_count = genre_affinities[genre]
            score += min(0.20, genre_count * 0.03)

        return min(1.0, score)

    # -------------------------------------------------------------------------
    # 6. TWO-STAGE PIPELINE: CANDIDATE GENERATION & RANKING
    # -------------------------------------------------------------------------
    def rank_catalog(
        self,
        catalog: List[Dict[str, Any]],
        liked_song_ids: List[str],
        play_events: List[Dict[str, Any]],
        current_song: Dict[str, Any] = None,
        mode: str = "for-you",
        top_n: int = 25,
        now: datetime = None
    ) -> List[Dict[str, Any]]:
        """
        Two-Stage Recommendation Pipeline:
        Stage 1: Generate Candidates (Trending, Accelerating, New Releases, User Taste)
        Stage 2: FreshPulse AI Scoring & Artist Diversity Filtering
        """
        if now is None:
            now = datetime.now(timezone.utc)

        liked_set = set(liked_song_ids)

        # Build User Affinities from events
        artist_affinities = Counter()
        genre_affinities = Counter()
        recent_play_times = {}

        for event in play_events:
            song_id = event.get("song_id")
            ts_str = event.get("timestamp")
            if ts_str and song_id:
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str
                    if song_id not in recent_play_times or ts > recent_play_times[song_id]:
                        recent_play_times[song_id] = ts
                except Exception:
                    pass

        for song in catalog:
            song_id = song.get("youtubeVideoId") or song.get("id") or song.get("_id")
            if song_id in liked_set:
                artist_affinities[song.get("artist", "")] += 3
                genre_affinities[song.get("category", "")] += 2

        # Calculate Trend Metrics
        trend_data = self.calculate_trend_metrics(play_events, now)

        # STAGE 2: FreshPulse AI Scoring
        scored_candidates = []

        for song in catalog:
            song_id = song.get("youtubeVideoId") or song.get("id") or song.get("_id")
            if not song_id:
                continue

            # 1. Freshness & Age Penalty
            freshness, age_penalty = self.calculate_freshness_score(song.get("releaseDate"), now)

            # 2. Trend & Momentum Metrics
            t_metrics = trend_data.get(song_id, {
                "current_pop_score": 0.1,
                "momentum_score": 0.05,
                "acceleration_score": 0.0,
                "explosion_score": 0.0,
            })

            # 3. User Taste
            user_taste = self.calculate_user_taste_score(song, liked_set, artist_affinities, genre_affinities)

            # 4. Smooth Transition (BPM & Energy)
            smooth_score = 0.5
            if current_song:
                bpm_smooth = self.calculate_bpm_harmonic_match(current_song.get("bpm", 110), song.get("bpm", 110))
                energy_smooth = 1.0 - abs(current_song.get("energy", 0.7) - song.get("energy", 0.7))
                smooth_score = (bpm_smooth * 0.6 + energy_smooth * 0.4)

            # 5. Repetition Penalty
            repetition_penalty = 0.0
            if song_id in recent_play_times:
                hours_since_play = (now - recent_play_times[song_id]).total_seconds() / 3600.0
                repetition_penalty = math.pow(2, -hours_since_play / self.config["half_life_repetition_hours"]) * 0.4

            # Mode-Based Weight Application
            if mode == "trending":
                fp_score = (
                    0.40 * t_metrics["current_pop_score"] +
                    0.30 * t_metrics["momentum_score"] +
                    0.20 * t_metrics["acceleration_score"] +
                    0.10 * freshness -
                    age_penalty * 0.5
                )
            elif mode == "new":
                fp_score = (
                    0.60 * freshness +
                    0.25 * t_metrics["momentum_score"] +
                    0.15 * user_taste -
                    age_penalty * 0.2
                )
            else:  # "for-you" (FreshPulse For You)
                fp_score = (
                    self.config["weight_current_popularity"] * t_metrics["current_pop_score"] +
                    self.config["weight_momentum"] * t_metrics["momentum_score"] +
                    self.config["weight_trend_acceleration"] * t_metrics["acceleration_score"] +
                    self.config["weight_user_taste"] * user_taste +
                    self.config["weight_freshness"] * freshness +
                    self.config["weight_smooth_transition"] * smooth_score -
                    age_penalty * 0.3 -
                    repetition_penalty
                )

            # Build Explainability Reasons
            reasons = []
            if t_metrics["explosion_score"] > 0.4:
                reasons.append("Exploding Momentum (+Rapid Growth)")
            if freshness >= 0.8:
                reasons.append("Fresh Release")
            if song_id in liked_set:
                reasons.append("In Your Liked Songs")
            elif user_taste > 0.4:
                reasons.append(f"Matches your taste for {song.get('artist')}")

            song_item = dict(song)
            song_item["fresh_pulse_score"] = round(fp_score, 4)
            song_item["explainability"] = reasons if reasons else ["Recommended for you"]

            scored_candidates.append(song_item)

        # Sort descending by FreshPulse AI score
        scored_candidates.sort(key=lambda s: s["fresh_pulse_score"], reverse=True)

        # Apply Diversity Filter (max 2 songs per artist in recommendations)
        artist_counts = Counter()
        diversified_results = []
        discovery_pool = []

        max_per_artist = self.config["max_songs_per_artist"]

        for item in scored_candidates:
            artist = item.get("artist", "Unknown")
            if artist_counts[artist] < max_per_artist:
                artist_counts[artist] += 1
                diversified_results.append(item)
            else:
                discovery_pool.append(item)

        # Inject 10% Discovery Candidates
        final_list = diversified_results[:top_n]
        if len(final_list) < top_n and discovery_pool:
            needed = top_n - len(final_list)
            final_list.extend(discovery_pool[:needed])

        return final_list


# =============================================================================
# CLI JSON INTERFACE FOR NODE.JS EXPRESS INTEGRATION
# =============================================================================
if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            input_json = sys.argv[1]
            data = json.loads(input_json)
        else:
            raw_input = sys.stdin.read()
            data = json.loads(raw_input) if raw_input and raw_input.strip() else {}

        catalog = data.get("catalog", [])
        liked_ids = data.get("liked_song_ids", [])
        events = data.get("play_events", [])
        current_song = data.get("current_playing_song", None)
        mode = data.get("mode", "for-you")
        limit = data.get("top_n", 25)

        engine = FreshPulseAI()
        results = engine.rank_catalog(catalog, liked_ids, events, current_song, mode, limit)

        print(json.dumps({
            "success": True,
            "algorithm": "FreshPulse AI",
            "mode": mode,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "songs": results
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
