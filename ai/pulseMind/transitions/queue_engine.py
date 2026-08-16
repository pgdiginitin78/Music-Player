from typing import List, Dict, Any
from ai.pulseMind.transitions.smooth_transition_engine import SmoothTransitionEngine

class SmartQueueEngine:
    """
    Ranks upcoming queue tracks based on user preference, current song similarity,
    and smooth transition flow without interrupting active playback.
    """

    @staticmethod
    def reorder_queue(
        current_song: Dict[str, Any], upcoming_queue: List[Dict[str, Any]], user_taste_engine=None
    ) -> List[Dict[str, Any]]:
        if not upcoming_queue:
            return []

        scored_queue = []
        for song in upcoming_queue:
            smooth_score = 0.7
            if current_song:
                smooth_score = SmoothTransitionEngine.calculate_transition_smoothness(current_song, song)

            taste_score = 0.5
            if user_taste_engine:
                taste_score = user_taste_engine.calculate_taste_score(song)

            queue_score = smooth_score * 0.6 + taste_score * 0.4
            item = dict(song)
            item["next_song_score"] = round(queue_score, 4)
            scored_queue.append(item)

        scored_queue.sort(key=lambda s: s["next_song_score"], reverse=True)
        return scored_queue
