from abc import ABC, abstractmethod
from typing import Dict, Any, List

class RecommendationModel(ABC):
    """
    Abstract interface for PulseMind AI Recommendation Models.
    Enables future seamless integration of ML models (Scikit-Learn, PyTorch, LightGBM)
    without altering Express routes or API contracts.
    """

    @abstractmethod
    def predict(self, features: Dict[str, Any]) -> float:
        """
        Calculates recommendation score for a given feature dictionary.
        Returns float between 0.0 and 1.0 (or unbounded relative score).
        """
        pass

    @abstractmethod
    def predict_batch(self, candidate_features: List[Dict[str, Any]]) -> List[float]:
        """
        Calculates recommendation scores for a list of candidate feature dictionaries.
        """
        pass
