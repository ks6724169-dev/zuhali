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
  // External APIs (Optional - if missing, cascade skips to free engines)
  tavilyApiKey: () => readEnvKey('TAVILY_API_KEY'),
  googleSearchApiKey: () => readEnvKey('GOOGLE_SEARCH_API_KEY'),
  googleSearchCx: () => readEnvKey('GOOGLE_SEARCH_CX'),
  serperApiKey: () => readEnvKey('SERPER_API_KEY'),
  serpApiKey: () => readEnvKey('SERPAPI_API_KEY'),

  // Public SearXNG Instances (Rotated automatically)
  searxngInstances: [
    'https://searx.be',
    'https://search.ononoki.org',
    'https://searx.work',
    'https://searx.tiekoetter.com',
  ],

  // Limits & Timeouts
  timeoutMs: 4500, // Max 4.5s per provider before cascading to next
};
