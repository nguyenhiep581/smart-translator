import { error as logError } from '../../utils/logger.js';

/**
 * Service to handle web searches using Google Programmable Search Engine API
 */
export class WebSearchService {
  constructor() {}

  /**
   * Search the web for the given query
   * @param {string} query - The search query
   * @param {Object} config - Web search configuration
   * @returns {Promise<string>} - Formatted search results
   */
  async search(query, config) {
    const provider = config.provider || 'ddg';

    if (provider === 'ddg') {
      return this.searchDuckDuckGo(query);
    }

    // Default to Google
    const { apiKey, cx } = config;
    if (!apiKey || !cx) {
      throw new Error('Web search configuration missing (API Key or CX)');
    }

    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('key', apiKey);
      url.searchParams.append('cx', cx);
      url.searchParams.append('q', query);
      url.searchParams.append('num', '5'); // Fetch top 5 results

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Search API error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return this.formatResults(data);
    } catch (err) {
      logError('Web search failed:', err);
      return `[Web Search Failed: ${err.message}]`;
    }
  }

  /**
   * Search using DuckDuckGo HTML scraping (Free)
   * @param {string} query
   * @returns {Promise<string>}
   */
  async searchDuckDuckGo(query) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`DuckDuckGo error: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseDuckDuckGoHtml(html);
    } catch (err) {
      logError('DuckDuckGo search failed:', err);
      return `[Web Search Failed: ${err.message}]`;
    }
  }

  /**
   * Parse DuckDuckGo HTML results using Regex
   * @param {string} html
   * @returns {string}
   */
  parseDuckDuckGoHtml(html) {
    const results = [];

    // Regex to find results blocks
    // Structure typically: <div class="result ..."> ... <a class="result__a" href="...">Title</a> ... <a class="result__snippet" ...>Snippet</a>

    // Simplified regex approach to find result blocks
    // We look for the title link pattern
    const resultRegex =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>.*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]+href="[^"]+"[^>]*>(.*?)<\/a>/gs;

    let match;
    let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < 5) {
      let link = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim(); // Remove any inner tags
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();

      // Decode DDG link if it's a redirect
      // /l/?uddg=...
      if (link.includes('uddg=')) {
        try {
          const urlObj = new URL(link, 'https://html.duckduckgo.com');
          const uddg = urlObj.searchParams.get('uddg');
          if (uddg) {
            link = decodeURIComponent(uddg);
          }
        } catch (e) {
          // ignore parsing error, use original link
        }
      }

      results.push({ title, link, snippet });
      count++;
    }

    if (results.length === 0) {
      return 'No web search results found (DuckDuckGo).';
    }

    return this.formatCustomResults(results);
  }

  formatCustomResults(items) {
    let output = 'Context from Web Search (DuckDuckGo):\n\n';
    items.forEach((item, index) => {
      output += `${index + 1}. ${item.title}\n`;
      output += `   Source: ${item.link}\n`;
      output += `   Snippet: ${item.snippet}\n\n`;
    });
    return output;
  }

  /**
   * Format Google search results
   * @param {Object} data - API response data
   * @returns {string} - Formatted string
   */
  formatResults(data) {
    if (!data.items || data.items.length === 0) {
      return 'No web search results found.';
    }

    let output = 'Context from Web Search (Google):\n\n';

    data.items.forEach((item, index) => {
      output += `${index + 1}. ${item.title}\n`;
      output += `   Source: ${item.link}\n`;
      output += `   Snippet: ${item.snippet}\n\n`;
    });

    return output;
  }
}

export const webSearchService = new WebSearchService();
