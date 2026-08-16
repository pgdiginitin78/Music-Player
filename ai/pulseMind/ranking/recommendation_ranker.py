from typing import List, Dict, Any
from datetime import datetime, timezone

from ai.pulseMind.config.settings import PULSEMIND_CONFIG
from ai.pulseMind.features.feature_extractor import FeatureExtractor
from ai.pulseMind.models.hybrid_model import HybridRankingModel
from ai.pulseMind.personalization.user_taste_engine import UserTasteEngine
from ai.pulseMind.trends.trend_engine import TrendEngine
from ai.pulseMind.trends.momentum_engine import MomentumEngine
from ai.pulseMind.discovery.freshness_engine import FreshnessEngine
from ai.pulseMind.discovery.discovery_engine import DiscoveryEngine
from ai.pulseMind.recommenders.similarity_engine import SimilarityEngine
from ai.pulseMind.transitions.smooth_transition_engine import SmoothTransitionEngine
from ai.pulseMind.analytics.debug_explainer import DebugExplainer

class RecommendationRanker:
    """
    Main Recommendation Orchestrator combining:
    User Taste + Real-time Trends + Momentum + Freshness + Similarity + Smooth Transitions + Diversity
    """

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or PULSEMIND_CONFIG
        self.ranking_model = HybridRankingModel(self.config)
        self.trend_engine = TrendEngine()
        self.discovery_engine = DiscoveryEngine(self.config.get("max_songs_per_artist", 2))

    def rank_catalog(
        self,
        catalog: List[Dict[str, Any]],
        user_id: str,
        user_profile_data: Dict[str, Any] = None,
        liked_song_ids: List[str] = None,
        play_events: List[Dict[str, Any]] = None,
        current_song: Dict[str, Any] = None,
        mode: str = "for-you",
        top_n: int = 25,
        debug_mode: bool = False,
        intent_constraints: Dict[str, Any] = None,
    ) -> List[Dict[str, Any]]:
        liked_song_ids = liked_song_ids or []
        play_events = play_events or []
        liked_set = set(liked_song_ids)
        now = datetime.now(timezone.utc)

        # Build isolated user taste engine
        taste_engine = UserTasteEngine(user_id, user_profile_data)
        taste_engine.update_from_events(play_events, liked_song_ids)

        # Calculate trend metrics across events
        trend_metrics_map = self.trend_engine.calculate_rolling_metrics(play_events, now)

        scored_candidates = []

        for song in catalog:
            song_id = song.get("youtubeVideoId") or song.get("id") or song.get("_id")
            if not song_id:
                continue

            extracted = FeatureExtractor.extract_song_features(song)
            is_liked = song_id in liked_set

            # Check intent constraints (e.g. language, artist, mood filtering)
            if intent_constraints:
                req_lang = intent_constraints.get("language")
                if req_lang and str(req_lang).lower() not in extracted["language"].lower():
                    continue

                req_artist = intent_constraints.get("artist")
                if req_artist and str(req_artist).lower() not in extracted["artist"].lower():
                    continue

                req_mood = intent_constraints.get("mood")
                if req_mood and str(req_mood).lower() not in extracted["genre"].lower() and str(req_mood).lower() not in extracted["title"].lower():
                    pass

            # 1. User Taste Score
            taste_score = taste_engine.calculate_taste_score(song, is_liked)

            # 2. Freshness & Age Penalty
            freshness, age_penalty = FreshnessEngine.calculate_freshness(extracted["release_date"], now)

            # 3. Trend & Momentum Metrics
            t_metrics = trend_metrics_map.get(song_id, {"current_pop_score": 0.1, "velocity": 0, "acceleration": 0, "plays_24h": 0, "plays_1h": 0})
            momentum, accel, explosion, trend_state = MomentumEngine.calculate_momentum(t_metrics)

            # 4. Old Song Suppression with Viral Override
            stale_penalty = MomentumEngine.evaluate_old_song_suppression(freshness, explosion)

            # 5. Song Similarity (if current_song provided)
            similarity_score = 0.5
            if current_song:
                similarity_score = SimilarityEngine.calculate_song_similarity(current_song, song)

            # 6. Smooth Transition Score
            smooth_score = 0.7
            if current_song:
                smooth_score = SmoothTransitionEngine.calculate_transition_smoothness(current_song, song)

            # Mode specific overrides
            if mode == "trending":
                fp_score = 0.40 * t_metrics["current_pop_score"] + 0.35 * momentum + 0.25 * accel
            elif mode == "new":
                fp_score = 0.60 * freshness + 0.25 * momentum + 0.15 * taste_score
            elif mode == "because-you-listened":
                fp_score = 0.50 * similarity_score + 0.35 * taste_score + 0.15 * smooth_score
            else:  # "for-you"
                features_dict = {
                    "user_taste": taste_score,
                    "current_popularity": t_metrics["current_pop_score"],
                    "momentum": momentum,
                    "trend_acceleration": accel,
                    "freshness": freshness,
                    "similarity": similarity_score,
                    "engagement_quality": 0.7,
                    "smooth_transition": smooth_score,
                    "discovery": 0.1,
                    "skip_penalty": 0.0,
                    "repetition_penalty": 0.0,
                    "stale_penalty": stale_penalty,
                }
                fp_score = self.ranking_model.predict(features_dict)

            # Build explainability reasons
            reasons = DebugExplainer.generate_explainability_reasons(
                song, taste_score, is_liked, trend_state, freshness
            )

            song_item = dict(song)
            song_item["score"] = round(fp_score, 4)
            song_item["reasons"] = reasons

            if debug_mode:
                song_item["debug"] = DebugExplainer.build_debug_breakdown(
                    taste_score, t_metrics["current_pop_score"], momentum, accel,
                    freshness, similarity_score, 0.7, smooth_score, 0.1,
                    0.0, 0.0, stale_penalty, fp_score
                )

            scored_candidates.append(song_item)

        # Sort descending by score
        scored_candidates.sort(key=lambda s: s["score"], reverse=True)

        # Diversity filtering
        return self.discovery_engine.apply_diversity_and_discovery(scored_candidates, top_n)
