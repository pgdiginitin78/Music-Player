import sys
import json
import math
from typing import List, Dict, Any

class AILyricsDurationAligner:
    """
    AI Lyrics & Music Duration Alignment Engine.
    
    1. Phonetic & Word Weighting:
       Calculates line duration based on word count, syllable weight, and character count.
       
    2. Intelligent Instrumental Pacing:
       Allocates realistic intro padding (~10% of track length) and outro padding (~5% of track length)
       so lyrics begin when vocals actually start.
       
    3. Dynamic Timestamp Generation:
       Computes exact startSec, endSec, and active line index for any playback currentTime.
    """

    def align_lyrics(self, lines: List[str], total_duration_sec: float) -> List[Dict[str, Any]]:
        """
        Aligns raw lyrics lines to the total song duration in seconds.
        """
        if not lines or total_duration_sec <= 0:
            return []

        # Filter out empty lines while maintaining index mapping
        clean_lines = [l.strip() for l in lines if l and l.strip()]
        if not clean_lines:
            return []

        # Instrumental padding
        intro_padding = min(15.0, max(5.0, total_duration_sec * 0.08))
        outro_padding = min(12.0, max(4.0, total_duration_sec * 0.05))
        vocal_duration = max(10.0, total_duration_sec - intro_padding - outro_padding)

        # Calculate phonetic weight for each line
        weights = []
        for line in clean_lines:
            words = line.split()
            word_count = len(words)
            char_count = len(line)
            # Syllable approximation
            weight = word_count * 1.5 + char_count * 0.2
            weights.append(max(1.0, weight))

        total_weight = sum(weights)

        # Allocate time ranges
        aligned_results = []
        current_time_cursor = intro_padding

        for idx, (line, weight) in enumerate(zip(clean_lines, weights)):
            line_duration = (weight / total_weight) * vocal_duration
            # Enforce minimum line display time (1.8s)
            line_duration = max(1.8, line_duration)

            start_sec = current_time_cursor
            end_sec = start_sec + line_duration
            current_time_cursor = end_sec

            aligned_results.append({
                "lineIndex": idx,
                "text": line,
                "startSec": round(start_sec, 2),
                "endSec": round(end_sec, 2),
                "durationSec": round(line_duration, 2),
            })

        return aligned_results

    def get_active_line_index(self, aligned_lines: List[Dict[str, Any]], current_time_sec: float) -> int:
        """
        Returns the active line index for a given playback current_time_sec.
        """
        if not aligned_lines:
            return 0

        for item in aligned_lines:
            if item["startSec"] <= current_time_sec <= item["endSec"]:
                return item["lineIndex"]

        if current_time_sec < aligned_lines[0]["startSec"]:
            return 0

        return len(aligned_lines) - 1


# -------------------------------------------------------------------------
# CLI JSON Interface
# -------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            input_json = sys.argv[1]
            data = json.loads(input_json)
        else:
            raw_input = sys.stdin.read()
            data = json.loads(raw_input) if raw_input and raw_input.strip() else {}

        raw_lines = data.get("lines", [])
        duration_sec = float(data.get("duration_sec", 210.0))
        current_time = float(data.get("current_time_sec", 0.0))

        aligner = AILyricsDurationAligner()
        aligned = aligner.align_lyrics(raw_lines, duration_sec)
        active_idx = aligner.get_active_line_index(aligned, current_time)

        print(json.dumps({
            "success": True,
            "alignedLines": aligned,
            "activeLineIndex": active_idx,
            "totalDurationSec": duration_sec,
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
