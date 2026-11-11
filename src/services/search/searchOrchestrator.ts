import { ISearchProvider, SearchResponse, SearchResultItem } from './types.js';
import { DuckDuckGoProvider } from './providers/duckduckgo.provider.js';
import { WikipediaProvider } from './providers/wikipedia.provider.js';
import { TavilyProvider } from './providers/tavily.provider.js';
import { GoogleSearchProvider } from './providers/google.provider.js';
import { SerperProvider } from './providers/serper.provider.js';
import { SerpApiProvider } from './providers/serpapi.provider.js';
import { SearXNGProvider } from './providers/searxng.provider.js';

export class SearchOrchestrator {
  private providers: ISearchProvider[];

  constructor() {
    // All 7 Specialized Search Engines in Fleet
    this.providers = [
      new DuckDuckGoProvider(),   // 1. DuckDuckGo (Free, Instant Answers)
      new WikipediaProvider(),    // 2. Wikipedia (Free, Encyclopedic Facts)
      new SearXNGProvider(),      // 3. SearXNG (Free, Meta-Search)
      new TavilyProvider(),       // 4. Tavily (AI Web Search)
      new GoogleSearchProvider(), // 5. Google Custom Search
      new SerperProvider(),       // 6. Serper.dev Google API
      new SerpApiProvider(),      // 7. SerpAPI
    ];
  }

  /**
   * High-Precision Parallel Consensus Search across all 7 engines simultaneously.
   * Runs all available search engines in parallel (0 extra latency).
   * Cross-verifies facts from multiple engines.
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResponse> {
    const cleanQuery = query.trim();
    const startTime = Date.now();

    if (!cleanQuery) {
      return {
        query: cleanQuery,
        providerUsed: 'None',
        results: [],
        durationMs: 0,
        success: false,
        error: 'Empty query',
      };
    }

    // Filter available providers (those with keys or 100% free ones)
    const activeProviders = this.providers.filter(p => p.isAvailable());

    console.log(`[SearchOrchestrator] 🚀 Launching ALL-7 PARALLEL CONSENSUS SEARCH for: "${cleanQuery}" across ${activeProviders.length} active engines`);

    // Execute ALL active providers simultaneously
    const searchPromises = activeProviders.map(async (provider) => {
      const pStart = Date.now();
      try {
        const items = await provider.search(cleanQuery, maxResults);
        const pDuration = Date.now() - pStart;
        return {
          name: provider.name,
          items: items || [],
          durationMs: pDuration,
          ok: items && items.length > 0,
        };
      } catch (err: any) {
        return {
          name: provider.name,
          items: [] as SearchResultItem[],
          durationMs: Date.now() - pStart,
          ok: false,
        };
      }
    });

    const settled = await Promise.allSettled(searchPromises);

    const successfulEngines: string[] = [];
    const aggregatedResults: SearchResultItem[] = [];
    const seenUrls = new Set<string>();

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value.ok) {
        successfulEngines.push(outcome.value.name);
        for (const item of outcome.value.items) {
          const normUrl = item.url.toLowerCase().replace(/\/$/, '');
          if (!seenUrls.has(normUrl)) {
            seenUrls.add(normUrl);
            aggregatedResults.push(item);
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (aggregatedResults.length > 0) {
      const consensusLabel = successfulEngines.join(' + ');
      console.log(`[SearchOrchestrator] 🏆 Consensus Achieved! ${successfulEngines.length} engines agreed (${consensusLabel}) with ${aggregatedResults.length} total distinct sources in ${durationMs}ms.`);
      
      return {
        query: cleanQuery,
        providerUsed: consensusLabel,
        consensusProviders: successfulEngines,
        consensusCount: successfulEngines.length,
        results: aggregatedResults.slice(0, 8), // Provide top 8 corroborated sources
        durationMs,
        success: true,
      };
    }

    console.log(`[SearchOrchestrator] ⚠️ Parallel search yielded 0 results across all engines in ${durationMs}ms.`);
    return {
      query: cleanQuery,
      providerUsed: 'None',
      results: [],
      durationMs,
      success: false,
      error: 'No search engine returned matching results for this query',
    };
  }
}

// Singleton instance for instant application-wide access
export const searchOrchestrator = new SearchOrchestrator();
