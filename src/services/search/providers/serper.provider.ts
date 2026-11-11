import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class SerperProvider implements ISearchProvider {
  readonly name = 'Serper';
  readonly isFreeNoKey = false;

  isAvailable(): boolean {
    return Boolean(searchSecurityConfig.serperApiKey());
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const apiKey = searchSecurityConfig.serperApiKey();
    if (!apiKey) return [];

    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
        }),
      });

      if (!res.ok) return [];

      const data = await res.json() as any;

      // Organic search results
      if (Array.isArray(data.organic)) {
        for (const item of data.organic) {
          results.push({
            title: item.title || '',
            snippet: item.snippet || '',
            url: item.link || '',
            source: this.name,
            publishedDate: item.date,
          });
        }
      }
    } catch {
      // Cascade to next
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
