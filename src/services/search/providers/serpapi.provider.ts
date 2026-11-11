import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class SerpApiProvider implements ISearchProvider {
  readonly name = 'SerpAPI';
  readonly isFreeNoKey = false;

  isAvailable(): boolean {
    return Boolean(searchSecurityConfig.serpApiKey());
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const apiKey = searchSecurityConfig.serpApiKey();
    if (!apiKey) return [];

    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&num=${maxResults}`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) return [];

      const data = await res.json() as any;

      if (Array.isArray(data.organic_results)) {
        for (const item of data.organic_results) {
          results.push({
            title: item.title || '',
            snippet: item.snippet || '',
            url: item.link || '',
            source: this.name,
          });
        }
      }
    } catch {
      // Fallback
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
