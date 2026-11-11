import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class TinyFishProvider implements ISearchProvider {
  readonly name = 'TinyFish';
  readonly isFreeNoKey = false;

  isAvailable(): boolean {
    return !!searchSecurityConfig.tinyfishApiKey();
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const key = searchSecurityConfig.tinyfishApiKey();
    if (!key) return [];

    try {
      const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'X-API-Key': key,
          'User-Agent': 'Mozilla/5.0 Zuhali-AI/1.0'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        console.warn(`[TinyFish] HTTP error: ${response.status}`);
        return [];
      }

      const data: any = await response.json();
      const results: SearchResultItem[] = [];

      for (const item of (data.results || []).slice(0, maxResults)) {
        const title = item.title || item.site_name || 'Web Result';
        const snippet = item.snippet || '';
        const link = item.url || '';
        if (title && (snippet || link)) {
          results.push({
            title: title.trim(),
            snippet: snippet.trim(),
            url: link.trim(),
            source: 'TinyFish AI',
            publishedDate: item.published_date || undefined
          });
        }
      }

      return results;
    } catch (err: any) {
      console.warn('[TinyFish] Search failed:', err.message);
      return [];
    }
  }
}
