from typing import Dict, Any, List

class DebugExplainer:
    """
    Generates explainability reasons and detailed debug score breakdowns for algorithm tuning.
    """

    @staticmethod
    def generate_explainability_reasons(
        song: Dict[str, Any],
        user_taste: float,
        is_liked: bool,
        momentum_state: str,
        freshness: float,
    ) -> List[str]:
        reasons = []
        artist = song.get("artist", "")

        if momentum_state in ["Exploding", "Trending"]:
            reasons.append(f"Exploding Momentum ({momentum_state})")

        if freshness >= 0.8:
            reasons.append("Fresh Release")

        if is_liked:
            reasons.append("In Your Liked Songs")
        elif user_taste > 0.35 and artist:
            reasons.append(f"Matches your taste for {artist}")

        if not reasons:
            reasons.append("Recommended for you based on current listening vibe")

        return reasons

    @staticmethod
    def build_debug_breakdown(
        user_taste: float,
        popularity: float,
        momentum: float,
        acceleration: float,
        freshness: float,
        similarity: float,
        engagement: float,
        smoothness: float,
        discovery: float,
        skip_penalty: float,
        repetition_penalty: float,
        stale_penalty: float,
        final_score: float,
    ) -> Dict[str, float]:
        return {
            "userTaste": round(user_taste, 4),
            "currentPopularity": round(popularity, 4),
            "momentum": round(momentum, 4),
            "acceleration": round(acceleration, 4),
            "freshness": round(freshness, 4),
            "similarity": round(similarity, 4),
            "engagement": round(engagement, 4),
            "smoothness": round(smoothness, 4),
            "discovery": round(discovery, 4),
            "skipPenalty": round(skip_penalty, 4),
            "repetitionPenalty": round(repetition_penalty, 4),
            "stalePenalty": round(stale_penalty, 4),
            "finalScore": round(final_score, 4),
        }
