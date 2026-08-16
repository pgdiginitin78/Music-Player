from typing import Dict, Any

class MoodMapper:
    """
    Maps natural human emotional states and scenario expressions
    (e.g., 'sad', 'feeling low', 'workout', 'relaxing', 'romantic', 'study', 'party', 'cheer me up')
    to concrete music target characteristics.
    """

    MOOD_MAPPINGS = {
        "sad": {"mood": "sad", "energy": "low", "valence": "low", "tempo": "slow", "category": "sad-hindi"},
        "feeling low": {"mood": "sad", "energy": "low", "valence": "low", "tempo": "slow", "category": "sad-hindi"},
        "lonely": {"mood": "sad", "energy": "low", "valence": "low", "tempo": "slow", "category": "sad-hindi"},
        "heartbroken": {"mood": "sad", "energy": "low", "valence": "low", "tempo": "slow", "category": "sad-hindi"},
        "relaxing": {"mood": "relaxing", "energy": "low", "valence": "medium", "tempo": "slow", "category": "chill-hindi"},
        "chill": {"mood": "relaxing", "energy": "low", "valence": "medium", "tempo": "slow", "category": "chill-hindi"},
        "peaceful": {"mood": "relaxing", "energy": "low", "valence": "medium", "tempo": "slow", "category": "chill-hindi"},
        "calm": {"mood": "relaxing", "energy": "low", "valence": "medium", "tempo": "slow", "category": "chill-hindi"},
        "study": {"mood": "study", "energy": "low", "valence": "medium", "tempo": "medium", "category": "study-hindi"},
        "happy": {"mood": "happy", "energy": "high", "valence": "high", "tempo": "fast", "category": "party-hindi"},
        "energetic": {"mood": "energetic", "energy": "high", "valence": "high", "tempo": "fast", "category": "party-hindi"},
        "party": {"mood": "party", "energy": "high", "valence": "high", "tempo": "fast", "category": "party-hindi"},
        "workout": {"mood": "workout", "energy": "high", "valence": "high", "tempo": "fast", "category": "gym-workout"},
        "gym": {"mood": "workout", "energy": "high", "valence": "high", "tempo": "fast", "category": "gym-workout"},
        "romantic": {"mood": "romantic", "energy": "medium", "valence": "high", "tempo": "medium", "category": "romantic-hindi"},
        "love": {"mood": "romantic", "energy": "medium", "valence": "high", "tempo": "medium", "category": "romantic-hindi"},
        "dreamy": {"mood": "dreamy", "energy": "low", "valence": "high", "tempo": "slow", "category": "indie-hindi"},
        "nostalgic": {"mood": "nostalgic", "energy": "medium", "valence": "medium", "tempo": "medium", "category": "retro-90s"},
        "cheer me up": {"mood": "happy", "energy": "high", "valence": "high", "tempo": "fast", "category": "party-hindi"},
    }

    @staticmethod
    def map_mood(text: str) -> Dict[str, Any]:
        text_lower = text.lower().strip()
        for kw, params in MoodMapper.MOOD_MAPPINGS.items():
            if kw in text_lower:
                return dict(params)
        return {"mood": None, "energy": None, "valence": None, "tempo": None, "category": None}
