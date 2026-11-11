import { searchOrchestrator } from './searchOrchestrator.js';
import { detectSearchIntent } from './intentDetector.js';
import { searchCache, buildGroundingPrompt } from './contextInjector.js';
import { SearchResultItem } from './types.js';

export interface LiveSearchResult {
  triggered: boolean;
  providerUsed?: string;
  results?: SearchResultItem[];
  groundingText?: string;
  durationMs?: number;
  consensusProviders?: string[];
  consensusCount?: number;
}

/**
 * High-level one-step function to automatically handle live web search
 * Can be plugged directly into any chat stream handler.
 */
export async function handleLiveSearchForPrompt(prompt: string): Promise<LiveSearchResult> {
  const intent = detectSearchIntent(prompt);

  if (!intent.requiresLiveSearch) {
    return { triggered: false };
  }

  const query = intent.cleanSearchQuery;

  // 1. Check local in-memory cache first (0ms latency)
  const cached = searchCache.get(query);
  if (cached && cached.results.length > 0) {
    console.log(`[LiveSearch] ⚡ Cache hit for query: "${query}" (originally via ${cached.providerUsed})`);
    return {
      triggered: true,
      providerUsed: `${cached.providerUsed} (Cached)`,
      results: cached.results,
      groundingText: buildGroundingPrompt(query, cached.results, cached.providerUsed),
      durationMs: 0,
    };
  }

  // 2. Execute 7-level fallback search
  const response = await searchOrchestrator.search(query, 5);

  if (response.success && response.results.length > 0) {
    // Save to cache
    searchCache.set(query, response.results, response.providerUsed);

    return {
      triggered: true,
      providerUsed: response.providerUsed,
      consensusProviders: response.consensusProviders,
      consensusCount: response.consensusCount,
      results: response.results,
      groundingText: buildGroundingPrompt(query, response.results, response.providerUsed),
      durationMs: response.durationMs,
    };
  }

  return {
    triggered: true,
    providerUsed: 'None',
    results: [],
    groundingText: '',
    durationMs: response.durationMs,
  };
}

export * from './types.js';
export { searchOrchestrator } from './searchOrchestrator.js';
export { detectSearchIntent } from './intentDetector.js';
