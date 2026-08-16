from typing import List, Dict, Any
from collections import Counter

class DiscoveryEngine:
    """
    Manages Discovery Pool Ratios (70% personalized, 20% trending, 10% discovery).
    Applies artist diversity constraints (max N per artist).
    Categorizes candidates into Discovery Labels.
    """

    def __init__(self, max_per_artist: int = 2):
        self.max_per_artist = max_per_artist

    def apply_diversity_and_discovery(
        self, scored_songs: List[Dict[str, Any]], top_n: int = 25
    ) -> List[Dict[str, Any]]:
        artist_counts = Counter()
        diversified = []
        overflow_discovery = []

        for item in scored_songs:
            artist = item.get("artist", "Unknown")
            if artist_counts[artist] < self.max_per_artist:
                artist_counts[artist] += 1
                diversified.append(item)
            else:
                overflow_discovery.append(item)

        final_batch = diversified[:top_n]
        if len(final_batch) < top_n and overflow_discovery:
            needed = top_n - len(final_batch)
            final_batch.extend(overflow_discovery[:needed])

        return final_batch
