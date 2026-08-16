import math
from datetime import datetime, timezone

class FreshnessEngine:
    """
    Evaluates song release age and calculates Freshness Score (0.0 to 1.0) and Age Penalty.
    0–7 days       -> 1.00 (extremely fresh)
    8–30 days      -> 0.85–0.95 (very fresh)
    31–60 days     -> 0.70–0.85 (fresh)
    61–90 days     -> 0.50–0.70 (moderate)
    91–180 days    -> 0.25–0.50 (low)
    180+ days      -> < 0.25 (penalized)
    """

    @staticmethod
    def calculate_freshness(release_date_str: str, now: datetime = None) -> tuple[float, float]:
        if now is None:
            now = datetime.now(timezone.utc)

        if not release_date_str:
            return 0.5, 0.0

        try:
            rel_date = datetime.fromisoformat(release_date_str.replace("Z", "+00:00"))
            age_days = max(0.0, (now - rel_date).total_seconds() / 86400.0)
        except Exception:
            return 0.5, 0.0

        if age_days <= 7:
            freshness = 1.0
            penalty = 0.0
        elif age_days <= 30:
            freshness = 0.85 + (30 - age_days) / 23 * 0.15
            penalty = 0.0
        elif age_days <= 60:
            freshness = 0.70 + (60 - age_days) / 30 * 0.15
            penalty = 0.05
        elif age_days <= 180:
            freshness = 0.30 + (180 - age_days) / 120 * 0.40
            penalty = 0.15
        else:
            freshness = max(0.05, 0.30 * math.exp(-(age_days - 180) / 180.0))
            penalty = min(0.35, 0.15 + (age_days - 180) / 365.0 * 0.20)

        return round(freshness, 4), round(penalty, 4)
