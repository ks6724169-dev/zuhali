// src/services/search/providers/google.provider.ts
import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

/**
 * Google Custom Search JSON API Provider (Free tier: 100 queries per day).
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX environment variables.
 */
export class GoogleSearchProvider implements ISearchProvider {
  readonly name = 'GoogleCustomSearch';
  readonly isFreeNoKey = false;

  isAvailable(): boolean {
    const key = searchSecurityConfig.googleSearchApiKey();
    const cx = searchSecurityConfig.googleSearchCx();
    return Boolean(key && cx);
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const apiKey = searchSecurityConfig.googleSearchApiKey();
    const cx = searchSecurityConfig.googleSearchCx();
    if (!apiKey || !cx) return [];

    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${maxResults}`;
      const resp = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!resp.ok) return [];
      const data = await resp.json() as any;
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          if (results.length >= maxResults) break;
          results.push({
            title: item.title || '',
            snippet: item.snippet || '',
            url: item.link || '',
            source: this.name,
          });
        }
      }
    } catch {
      // Graceful fallback on network error / timeout / quota exhaustion
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
