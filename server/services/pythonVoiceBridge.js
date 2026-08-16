import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PARO_VOICE_DIR = path.resolve(__dirname, '../../paro_voice');
const MAIN_PY = path.resolve(PARO_VOICE_DIR, 'main.py');

let voiceServiceProcess = null;

export async function ensurePythonVoiceServiceRunning() {
  // Check if service is already running on http://127.0.0.1:5050/health
  try {
    const res = await fetch('http://127.0.0.1:5050/health', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      console.log('[PARO VOICE BRIDGE] Python Voice Service is already running on http://127.0.0.1:5050');
      return true;
    }
  } catch (err) {
    // Service not running; proceed to auto-spawn
  }

  if (voiceServiceProcess) {
    return true;
  }

  console.log('[PARO VOICE BRIDGE] Auto-starting PARO Python Voice Service (paro_voice/main.py)...');

  try {
    // Check if venv python exists
    const venvPython = path.resolve(PARO_VOICE_DIR, 'venv/Scripts/python.exe');
    const pythonExec = (await fileExists(venvPython)) ? venvPython : 'python';

    voiceServiceProcess = spawn(pythonExec, [MAIN_PY], {
      cwd: PARO_VOICE_DIR,
      stdio: 'inherit',
      env: { ...process.env, PYTHONPATH: PARO_VOICE_DIR },
      detached: false,
    });

    voiceServiceProcess.on('error', (err) => {
      console.warn('[PARO VOICE BRIDGE WARN] Unable to auto-spawn Python voice service:', err.message);
      voiceServiceProcess = null;
    });

    voiceServiceProcess.on('exit', (code) => {
      console.warn(`[PARO VOICE BRIDGE WARN] Python voice service process exited with code ${code}`);
      voiceServiceProcess = null;
    });

    return true;
  } catch (err) {
    console.warn('[PARO VOICE BRIDGE WARN] Auto-start failed:', err.message);
    return false;
  }
}

async function fileExists(filePath) {
  try {
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
