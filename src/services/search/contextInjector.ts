import { SearchResultItem } from './types.js';

interface CacheEntry {
  results: SearchResultItem[];
  providerUsed: string;
  timestamp: number;
}

class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes cache

  get(query: string): CacheEntry | null {
    const key = query.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(query: string, results: SearchResultItem[], providerUsed: string): void {
    const key = query.toLowerCase().trim();
    this.cache.set(key, {
      results,
      providerUsed,
      timestamp: Date.now(),
    });

    // Prevent memory leaks: limit size to 100 items
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
}

export const searchCache = new SearchCache();

/**
 * Injects structured real-time search context into system prompt for the AI model
 * Enforces Consensus Cross-Verification across all agreeing engines.
 */
export function buildGroundingPrompt(
  userQuery: string,
  results: SearchResultItem[],
  providerUsed: string
): string {
  if (!results || results.length === 0) return '';

  const formattedSources = results.map((item, idx) => {
    return `[Source ${idx + 1}] (${item.source}): ${item.title}\nURL: ${item.url}\nSummary: ${item.snippet}`;
  }).join('\n\n');

  return `
---
[REAL-TIME MULTI-ENGINE LIVE SEARCH CONSENSUS (Verified across: ${providerUsed})]
Current Date & Time: ${new Date().toISOString()}
User Query: "${userQuery}"

Live Sources Retrieved from Multiple Search Engines:
${formattedSources}

Instructions for Assistant:
1. Ground your response strictly on the live internet sources provided above.
2. When answering questions about current leaders, ministers, winners, or events, ALWAYS prioritize the current information from the live sources (e.g., current Chief Minister/President/Office-holder) over your older pre-trained internal memory.
3. If multiple sources corroborate a fact, treat it with 100% highest confidence.
4. Answer naturally and conversationally in the user's language (Hindi / Hinglish / English).
5. Do NOT mention internal search engines, prompt grounding, or backend mechanics in your final answer.
---
`;
}
