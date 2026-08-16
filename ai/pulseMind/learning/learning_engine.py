from typing import Dict, Any, List
from ai.pulseMind.learning.feedback_engine import FeedbackEngine

class LearningEngine:
    """
    Manages continuous learning loop updates by integrating feedback signals
    into user taste profiles and recommendation weights.
    """

    @staticmethod
    def process_feedback_loop(
        user_taste_engine, events: List[Dict[str, Any]], liked_song_ids: List[str]
    ):
        """Executes incremental user taste profile learning step."""
        if user_taste_engine and events:
            user_taste_engine.update_from_events(events, liked_song_ids)
