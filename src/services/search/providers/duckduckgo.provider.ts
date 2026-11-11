import { ISearchProvider, SearchResultItem } from '../types.js';
import { searchSecurityConfig } from '../config.js';

export class DuckDuckGoProvider implements ISearchProvider {
  readonly name = 'DuckDuckGo';
  readonly isFreeNoKey = true;

  isAvailable(): boolean {
    return true; // Always available, no key needed
  }

  async search(query: string, maxResults: number = 5): Promise<SearchResultItem[]> {
    const results: SearchResultItem[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), searchSecurityConfig.timeoutMs);

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) return [];

      const data = await res.json() as any;

      // 1. Direct Abstract Text
      if (data.Heading && data.AbstractText) {
        results.push({
          title: data.Heading,
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
          source: this.name,
        });
      }

      // 2. Related Topics
      if (Array.isArray(data.RelatedTopics)) {
        for (const item of data.RelatedTopics) {
          if (results.length >= maxResults) break;
          if (item && item.Text && item.FirstURL) {
            const titlePart = item.Text.split(' - ')[0] || item.Text.substring(0, 50);
            results.push({
              title: titlePart,
              snippet: item.Text,
              url: item.FirstURL,
              source: this.name,
            });
          } else if (item && Array.isArray(item.Topics)) {
            // Nested sub-topics
            for (const subItem of item.Topics) {
              if (results.length >= maxResults) break;
              if (subItem && subItem.Text && subItem.FirstURL) {
                results.push({
                  title: subItem.Text.split(' - ')[0] || subItem.Text.substring(0, 50),
                  snippet: subItem.Text,
                  url: subItem.FirstURL,
                  source: this.name,
                });
              }
            }
          }
        }
      }

      // 3. Fallback to Full DuckDuckGo Live Web HTML Search if Instant Answer had 0 results
      if (results.length === 0) {
        try {
          const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            const regex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
            let match;
            while ((match = regex.exec(html)) !== null && results.length < maxResults) {
              let link = match[1];
              if (link.includes('uddg=')) {
                try {
                  const parsed = new URL('https:' + (link.startsWith('http') ? link : 'https:' + link));
                  link = decodeURIComponent(parsed.searchParams.get('uddg') || link);
                } catch {}
              }
              const snippet = match[2]
                .replace(/<[^>]+>/g, '')
                .replace(/&#x27;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .trim();
              if (snippet) {
                results.push({
                  title: `${query} web source`,
                  snippet,
                  url: link,
                  source: this.name,
                });
              }
            }
          }
        } catch {}
      }
    } catch {
      // Return empty array to allow immediate seamless fallback
    } finally {
      clearTimeout(timeout);
    }

    return results;
  }
}
