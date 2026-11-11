import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class SearXNGProvider implements ISearchProvider {
  readonly name = 'SearXNG';
  readonly isFreeNoKey = true;

  isAvailable(): boolean {
    return true; // Zero key required, runs on public distributed instances
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const instances = searchSecurityConfig.searxngInstances;

    // Try instances in sequence
    for (const baseUrl of instances) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500); // Quick 3.5s timeout per instance

      try {
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&language=auto`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        });

        if (!res.ok) continue;

        const data = await res.json() as any;

        if (Array.isArray(data.results) && data.results.length > 0) {
          const results: SearchResultItem[] = [];
          for (const item of data.results) {
            if (results.length >= maxResults) break;
            if (item.title && item.url) {
              results.push({
                title: item.title,
                snippet: item.content || item.snippet || `${item.title} information`,
                url: item.url,
                source: this.name,
                publishedDate: item.publishedDate,
              });
            }
          }
          if (results.length > 0) {
            clearTimeout(timeout);
            return results;
          }
        }
      } catch {
        // Try next instance
      } finally {
        clearTimeout(timeout);
      }
    }

    return [];
  }
}
