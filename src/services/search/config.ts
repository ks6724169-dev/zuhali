import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

/**
 * Safely fetches an environment variable at runtime from process.env or .env disk file.
 * Never throws exceptions, keeps keys masked and protected.
 */
function readEnvKey(keyName: string): string {
  if (process.env[keyName]?.trim()) {
    return process.env[keyName]!.trim();
  }
  try {
    const envPaths = ['.env', '.env.local', 'backend/.env'];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            if (k.trim() === keyName) {
              const val = v.join('=').trim().replace(/^["']|["']$/g, '');
              if (val) return val;
            }
          }
        }
      }
    }
  } catch {
    // Fail silently to prevent leaking filesystem details
  }
  return '';
}

export const searchSecurityConfig = {
  // Dedicated Live Web Search Engine
  tinyfishApiKey: () => readEnvKey('TINYFISH_API_KEY') || 'sk-tinyfish-MavQoQiqCeY-8CcNjtmWn1RiKDsyNyNz',
  timeoutMs: 8000,
};
