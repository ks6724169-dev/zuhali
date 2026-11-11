/**
 * Standard item structure returned by all search providers
 */
export interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  source: string; // e.g. 'DuckDuckGo', 'Wikipedia', 'Tavily', etc.
  publishedDate?: string;
  score?: number;
}

/**
 * Standard aggregated response from the search orchestrator
 */
export interface SearchResponse {
  query: string;
  providerUsed: string;
  results: SearchResultItem[];
  durationMs: number;
  success: boolean;
  error?: string;
  consensusProviders?: string[];
  consensusCount?: number;
}

/**
 * Base contract that every search engine adapter must implement
 */
export interface ISearchProvider {
  readonly name: string;
  readonly isFreeNoKey: boolean;
  isAvailable(): boolean;
  search(query: string, maxResults?: number): Promise<SearchResultItem[]>;
}
