import sys
import json
from datetime import datetime, timezone

from ai.pulseMind.ranking.recommendation_ranker import RecommendationRanker
from ai.pulseMind.agent.intent_parser import IntentParser
from ai.pulseMind.agent.dialog_manager import DialogManager
from ai.pulseMind.agent.tool_orchestrator import ToolOrchestrator

def handle_chat_request(data: dict) -> dict:
    user_id = data.get("user_id", "default_user")
    message = data.get("message", "")
    player_state = data.get("player_state", {})
    catalog = data.get("catalog", [])
    liked_ids = data.get("liked_song_ids", [])
    play_events = data.get("play_events", [])
    session_context = data.get("session_context", None)

    # 1. Parse natural language intent
    raw_intent = IntentParser.parse_user_message(message, player_state)

    # 2. Update multi-turn dialog memory
    dialog_mgr = DialogManager(session_context)
    resolved_intent = dialog_mgr.update_and_resolve_intent(raw_intent, player_state)

    # 3. Orchestrate actions and reply
    reply, actions = ToolOrchestrator.orchestrate_actions(resolved_intent, player_state)

    # 4. Rank candidates if needed
    ranker = RecommendationRanker()
    recommended_songs = []
    if catalog and actions and actions[0].get("type") == "PLAY_RECOMMENDED_QUEUE":
        mode = actions[0].get("mode", "for-you")
        recommended_songs = ranker.rank_catalog(
            catalog=catalog,
            user_id=user_id,
            liked_song_ids=liked_ids,
            play_events=play_events,
            current_song=player_state.get("currentSong"),
            mode=mode,
            top_n=25,
            intent_constraints=resolved_intent
        )

    return {
        "success": True,
        "algorithm": "PulseMind AI Conversational Agent",
        "version": "1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reply": reply,
        "actions": actions,
        "intent": resolved_intent,
        "sessionContext": dialog_mgr.export_session(),
        "songs": recommended_songs
    }

def handle_recommendation_request(data: dict) -> dict:
    user_id = data.get("user_id", "default_user")
    catalog = data.get("catalog", [])
    user_profile = data.get("user_profile", None)
    liked_ids = data.get("liked_song_ids", [])
    play_events = data.get("play_events", [])
    current_song = data.get("current_playing_song", None)
    mode = data.get("mode", "for-you")
    limit = data.get("top_n", 25)
    debug_mode = data.get("debug", False)

    ranker = RecommendationRanker()
    results = ranker.rank_catalog(
        catalog=catalog,
        user_id=user_id,
        user_profile_data=user_profile,
        liked_song_ids=liked_ids,
        play_events=play_events,
        current_song=current_song,
        mode=mode,
        top_n=limit,
        debug_mode=debug_mode
    )

    return {
        "success": True,
        "algorithm": "PulseMind AI",
        "version": "1.0",
        "mode": mode,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "songs": results
    }

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            input_json = sys.argv[1]
            data = json.loads(input_json)
        else:
            raw_input = sys.stdin.read()
            data = json.loads(raw_input) if raw_input and raw_input.strip() else {}

        req_mode = data.get("request_type") or ("chat" if "message" in data else "recommendation")

        if req_mode == "chat":
            response = handle_chat_request(data)
        else:
            response = handle_recommendation_request(data)

        print(json.dumps(response))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
