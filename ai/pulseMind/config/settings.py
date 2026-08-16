"""
PulseMind AI Central Configuration
Configurable weights, half-lives, skip penalties, discovery ratios, and diversity limits.
"""

PULSEMIND_CONFIG = {
    # Hybrid Ranking Weights (Sum to 1.0)
    "weights": {
        "user_taste": 0.25,
        "current_popularity": 0.20,
        "momentum": 0.15,
        "trend_acceleration": 0.10,
        "freshness": 0.10,
        "song_similarity": 0.05,
        "engagement_quality": 0.05,
        "smooth_transition": 0.05,
        "discovery": 0.05,
    },

    # Decay & Time Constants
    "momentum_half_life_hours": 12.0,
    "repetition_penalty_half_life_hours": 3.0,

    # Penalties
    "penalties": {
        "skip_under_3s": 0.50,
        "skip_under_15s": 0.30,
        "skip_under_45s": 0.15,
        "stale_song": 0.20,
        "repetition": 0.35,
    },

    # Discovery Pool Ratios
    "discovery_ratios": {
        "personalized": 0.70,
        "trending_fresh": 0.20,
        "serendipitous_discovery": 0.10,
    },

    # Diversity Rules
    "max_songs_per_artist": 2,
    "max_songs_per_album": 3,

    # Versioning
    "version": "1.0-PulseMind",
    "algorithm": "PulseMind AI Hybrid Intelligence Layer"
}
