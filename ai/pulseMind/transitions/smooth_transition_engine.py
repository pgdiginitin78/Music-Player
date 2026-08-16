from typing import Dict, Any

class SmoothTransitionEngine:
    """
    Computes Smooth Transition score (0.0 to 1.0) between current playing song and candidate.
    Considers energy progression, harmonic BPM matching, and mood flow.
    """

    @staticmethod
    def calculate_transition_smoothness(
        current_song: Dict[str, Any], candidate_song: Dict[str, Any]
    ) -> float:
        if not current_song or not candidate_song:
            return 0.7  # Default safe transition score

        # 1. Harmonic BPM Matching (1:1, 1:2 double-time, 2:1 half-time)
        bpm1 = float(current_song.get("tempo") or current_song.get("bpm", 110))
        bpm2 = float(candidate_song.get("tempo") or candidate_song.get("bpm", 110))
        candidates = [bpm2, bpm2 * 2.0, bpm2 / 2.0]
        min_diff = min(abs(bpm1 - c) for c in candidates)
        bpm_match = max(0.2, 1.0 - (min_diff / 35.0))

        # 2. Energy Progression
        e1 = float(current_song.get("energy", 0.65))
        e2 = float(candidate_song.get("energy", 0.65))
        energy_match = max(0.2, 1.0 - abs(e1 - e2))

        # 3. Genre / Category Continuity
        cat1 = str(current_song.get("category", "")).lower()
        cat2 = str(candidate_song.get("category", "")).lower()
        category_match = 1.0 if cat1 and cat1 == cat2 else 0.75

        smoothness = (bpm_match * 0.45 + energy_match * 0.45 + category_match * 0.10)
        return round(min(1.0, max(0.1, smoothness)), 4)
