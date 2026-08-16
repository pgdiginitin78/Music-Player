import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SCRIPT_PATH = path.join(__dirname, 'fresh_pulse_ai.py');

/**
 * Invokes FreshPulse AI Recommendation Engine in Python.
 * 
 * @param {Array} catalog - List of available songs
 * @param {Array} likedSongIds - Array of song IDs liked by user
 * @param {Array} playEvents - Today's play logs & engagement events
 * @param {Object} currentPlayingSong - Current active song
 * @param {string} mode - 'for-you', 'trending', or 'new'
 * @param {number} topN - Number of recommended songs to return
 * @returns {Promise<Array>} Ranked songs list with explainability
 */
export async function getFreshPulseRecommendations({
  catalog = [],
  likedSongIds = [],
  playEvents = [],
  currentPlayingSong = null,
  mode = 'for-you',
  topN = 25,
}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      catalog,
      liked_song_ids: likedSongIds,
      play_events: playEvents,
      current_playing_song: currentPlayingSong,
      mode,
      top_n: topN,
    });

    const pythonProcess = spawn('python', [PYTHON_SCRIPT_PATH, payload]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0 || !outputData) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[FRESHPULSE AI WARN] Python process fallback:', errorData || code);
        }
        return resolve(catalog.slice(0, topN));
      }

      try {
        const result = JSON.parse(outputData);
        if (result.success && Array.isArray(result.songs)) {
          return resolve(result.songs);
        }
        resolve(catalog.slice(0, topN));
      } catch (err) {
        console.warn('[FRESHPULSE AI PARSE WARN] Parse output failed:', err.message);
        resolve(catalog.slice(0, topN));
      }
    });

    pythonProcess.on('error', (err) => {
      console.warn('[FRESHPULSE AI EXEC WARN] Python invocation unavailable:', err.message);
      resolve(catalog.slice(0, topN));
    });
  });
}

export default { getFreshPulseRecommendations };
