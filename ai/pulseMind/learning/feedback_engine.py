from typing import Dict, Any

class FeedbackEngine:
    """
    Evaluates play/skip feedback quality based on listening duration & completion ratios:
    - Played < 3s: -0.80 (heavy skip penalty)
    - Played < 15s: -0.40 (negative penalty)
    - Played < 45s: -0.15 (mild negative)
    - Ratio >= 70%: +0.60 (positive)
    - Ratio >= 90%: +1.00 (strong completion positive)
    - Replay event: +2.50 (intentional replay peak)
    """

    @staticmethod
    def evaluate_feedback(event: Dict[str, Any]) -> tuple[float, float]:
        """
        Returns (quality_score, skip_penalty)
        """
        event_type = event.get("eventType") or event.get("event", "play")
        played_sec = float(event.get("durationPlayedSec", event.get("duration_played_sec", 0)))
        total_sec = max(1.0, float(event.get("totalSongDurationSec", event.get("total_duration_sec", 210))))
        skipped = event.get("skipped", False)

        ratio = played_sec / total_sec

        if event_type == "replay":
            return 2.50, 0.0
        elif skipped and played_sec < 3.0:
            return -0.80, 0.50
        elif skipped and played_sec < 15.0:
            return -0.40, 0.30
        elif skipped and played_sec < 45.0:
            return -0.15, 0.15
        elif ratio >= 0.90:
            return 1.00, 0.0
        elif ratio >= 0.70:
            return 0.60, 0.0
        elif ratio >= 0.40:
            return 0.20, 0.0
        else:
            return 0.0, 0.05
