from typing import Dict, Any, List
from ai.pulseMind.models.base_model import RecommendationModel
from ai.pulseMind.config.settings import PULSEMIND_CONFIG

class RuleBasedModel(RecommendationModel):
    """
    Rule-based baseline ranking model.
    """
    def predict(self, features: Dict[str, Any]) -> float:
        pop = features.get("current_popularity", 0.1)
        like = 0.5 if features.get("is_liked") else 0.0
        return min(1.0, pop * 0.5 + like)

    def predict_batch(self, candidate_features: List[Dict[str, Any]]) -> List[float]:
        return [self.predict(f) for f in candidate_features]

class HybridRankingModel(RecommendationModel):
    """
    Configurable Hybrid Ranking Model combining User Taste, Current Popularity, Momentum,
    Trend Acceleration, Freshness, Song Similarity, Engagement Quality, Smooth Transition, and Discovery.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or PULSEMIND_CONFIG
        self.weights = self.config["weights"]

    def predict(self, features: Dict[str, Any]) -> float:
        user_taste = features.get("user_taste", 0.0)
        popularity = features.get("current_popularity", 0.1)
        momentum = features.get("momentum", 0.0)
        accel = features.get("trend_acceleration", 0.0)
        freshness = features.get("freshness", 0.5)
        similarity = features.get("similarity", 0.5)
        engagement = features.get("engagement_quality", 0.5)
        smoothness = features.get("smooth_transition", 0.5)
        discovery = features.get("discovery", 0.1)

        raw_score = (
            self.weights["user_taste"] * user_taste +
            self.weights["current_popularity"] * popularity +
            self.weights["momentum"] * momentum +
            self.weights["trend_acceleration"] * accel +
            self.weights["freshness"] * freshness +
            self.weights["song_similarity"] * similarity +
            self.weights["engagement_quality"] * engagement +
            self.weights["smooth_transition"] * smoothness +
            self.weights["discovery"] * discovery
        )

        skip_penalty = features.get("skip_penalty", 0.0)
        repetition_penalty = features.get("repetition_penalty", 0.0)
        stale_penalty = features.get("stale_penalty", 0.0)

        final_score = raw_score - skip_penalty - repetition_penalty - stale_penalty
        return max(0.0, round(final_score, 4))

    def predict_batch(self, candidate_features: List[Dict[str, Any]]) -> List[float]:
        return [self.predict(f) for f in candidate_features]
