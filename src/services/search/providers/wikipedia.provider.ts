import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class WikipediaProvider implements ISearchProvider {
  readonly name = 'Wikipedia';
  readonly isFreeNoKey = true;

  isAvailable(): boolean {
    return true; // Always available, no key needed
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      // Wikipedia OpenSearch API: [query, [titles], [descriptions], [urls]]
      const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ZuhaliSearchBot/1.0 (Educational/Assistant Application)',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) return [];

      const data = await res.json() as any;

      if (Array.isArray(data) && data.length >= 4) {
        const titles = data[1] || [];
        const snippets = data[2] || [];
        const urls = data[3] || [];

        if (titles.length > 0) {
          // Fetch direct summary extract for top result
          try {
            const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(String(titles[0]).replace(/\s+/g, '_'))}`;
            const sumRes = await fetch(sumUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(2000),
            });
            if (sumRes.ok) {
              const sumData = await sumRes.json() as any;
              if (sumData.extract) {
                snippets[0] = sumData.extract;
              }
            }
          } catch {}
        }

        for (let i = 0; i < titles.length; i++) {
          if (results.length >= maxResults) break;
          const snippetText = snippets[i] && snippets[i].trim() ? snippets[i].trim() : `${titles[i]} - Wikipedia information.`;
          results.push({
            title: titles[i] || '',
            snippet: snippetText,
            url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(titles[i])}`,
            source: this.name,
          });
        }
      }
    } catch {
      // Return empty array for graceful cascading
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
