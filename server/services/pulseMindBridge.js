import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute path to PulseMind Python entry point: d:\myprojects\client\ai\pulseMind\index.py
const PULSEMIND_PYTHON_PATH = path.resolve(__dirname, '../../ai/pulseMind/index.py');
const PROJECT_ROOT = path.resolve(__dirname, '../../');

/**
 * Invokes PulseMind AI Engine in Python asynchronously.
 */
export async function invokePulseMindAI(payload = {}) {
  return new Promise((resolve) => {
    const jsonString = JSON.stringify(payload);
    const pythonProcess = spawn('python', [PULSEMIND_PYTHON_PATH, jsonString], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONPATH: PROJECT_ROOT },
    });

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
          console.warn('[PULSEMIND BRIDGE WARN] Python process fallback:', errorData || code);
        }
        return resolve(getJavaScriptFallback(payload));
      }

      try {
        const result = JSON.parse(outputData);
        if (result.success) {
          return resolve(result);
        }
        resolve(getJavaScriptFallback(payload));
      } catch (err) {
        console.warn('[PULSEMIND BRIDGE PARSE WARN] Output parse failed:', err.message);
        resolve(getJavaScriptFallback(payload));
      }
    });

    pythonProcess.on('error', (err) => {
      console.warn('[PULSEMIND BRIDGE EXEC WARN] Python process unavailable:', err.message);
      resolve(getJavaScriptFallback(payload));
    });
  });
}

function getJavaScriptFallback(payload) {
  const catalog = payload.catalog || [];
  const mode = payload.mode || 'for-you';
  const topN = payload.top_n || 25;
  const isChat = Boolean(payload.message);

  if (isChat) {
    return {
      success: true,
      algorithm: 'PulseMind AI JS Fallback',
      reply: 'Starting a personalized mix based on your taste 🎧',
      actions: [
        {
          type: 'PLAY_RECOMMENDED_QUEUE',
          mode: 'for-you',
          params: {},
        },
      ],
      songs: catalog.slice(0, topN),
    };
  }

  return {
    success: true,
    algorithm: 'PulseMind AI JS Fallback',
    mode,
    generatedAt: new Date().toISOString(),
    songs: catalog.slice(0, topN),
  };
}

export default { invokePulseMindAI };
