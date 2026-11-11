import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class TavilyProvider implements ISearchProvider {
  readonly name = 'Tavily';
  readonly isFreeNoKey = false;

  isAvailable(): boolean {
    return Boolean(searchSecurityConfig.tavilyApiKey());
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const apiKey = searchSecurityConfig.tavilyApiKey();
    if (!apiKey) return [];

    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'basic',
          include_answer: true,
          max_results: maxResults,
        }),
      });

      if (!res.ok) return []; // 429 quota full or other error, fallback to next

      const data = await res.json() as any;

      if (data.answer) {
        results.push({
          title: 'Direct Answer',
          snippet: data.answer,
          url: 'https://tavily.com',
          source: this.name,
        });
      }

      if (Array.isArray(data.results)) {
        for (const item of data.results) {
          if (results.length >= maxResults) break;
          results.push({
            title: item.title || '',
            snippet: item.content || '',
            url: item.url || '',
            source: this.name,
            publishedDate: item.published_date,
            score: item.score,
          });
        }
      }
    } catch {
      // Fallback seamlessly
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
