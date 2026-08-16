from typing import Dict, Any, Tuple

class MomentumEngine:
    """
    Calculates Momentum & Acceleration Scores.
    Detects song trend states: Rising, Trending, Exploding, Stable, Declining, Dead.
    Implements Old Song Suppression with Viral Override capability.
    """

    @staticmethod
    def calculate_momentum(trend_metrics: Dict[str, float]) -> Tuple[float, float, float, str]:
        """
        Returns:
            momentum_score (0.0 - 1.0)
            acceleration_score (0.0 - 1.0)
            explosion_score (0.0 - 1.0)
            trend_state (Rising, Trending, Exploding, Stable, Declining, Dead)
        """
        p_1h = trend_metrics.get("plays_1h", 0)
        p_24h = trend_metrics.get("plays_24h", 0)
        accel = trend_metrics.get("acceleration", 0.0)

        momentum = min(1.0, (p_1h * 3.0 + p_24h * 0.5) / 15.0)
        accel_score = min(1.0, max(0.0, accel / 4.0))
        explosion = min(1.0, momentum * 0.5 + accel_score * 0.5)

        if explosion > 0.6:
            state = "Exploding"
        elif momentum > 0.4:
            state = "Trending"
        elif accel > 0.1:
            state = "Rising"
        elif p_24h > 5:
            state = "Stable"
        elif p_24h > 0:
            state = "Declining"
        else:
            state = "Dead"

        return round(momentum, 4), round(accel_score, 4), round(explosion, 4), state

    @staticmethod
    def evaluate_old_song_suppression(freshness_score: float, explosion_score: float) -> float:
        """
        Old Song Suppression mechanism:
        If song is old (low freshness), apply penalty UNLESS the song has high explosion score (viral override!).
        """
        if freshness_score < 0.3 and explosion_score > 0.5:
            # Viral Override! Do not penalize old song if it's currently exploding
            return 0.0
        elif freshness_score < 0.2:
            return 0.25
        elif freshness_score < 0.4:
            return 0.10
        return 0.0
