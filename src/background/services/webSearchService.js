import { error as logError, debug as logDebug } from '../../utils/logger.js';

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
    const provider = config.provider || 'google';

    if (provider === 'bing') {
      return this.searchBing(query);
    }
    if (provider === 'ddg' || provider === 'duckduckgo') {
      return this.searchDuckDuckGo(query);
    }

    // Default to Google
    return this.searchGoogle(query);
  }

  unwrapBingUrl(rawUrl) {
    try {
      const urlObj = new URL(rawUrl);
      const uVals = urlObj.searchParams.getAll('u');
      if (!uVals.length) {
        return rawUrl;
      }
      const u = uVals[0];
      if (u.length <= 2) {
        return rawUrl;
      }
      const b64 = u.slice(2);
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      return decoded;
    } catch (e) {
      return rawUrl;
    }
  }

  /**
   * Search using Bing HTML scraping
   * @param {string} query
   * @returns {Promise<string>}
   */
  async searchBing(query) {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&setlang=en-us&cc=us`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
        },
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logError(
          `[Bing] fetch failed status=${response.status} statusText=${response.statusText} ` +
            `body=${errBody.slice(0, 500)}`,
        );
        throw new Error(`Bing error: ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      const results = [];
      // Updated regex to handle b_caption wrapper around the snippet paragraph
      const blockRegex =
        /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>(.*?)<\/p>)?/gi;
      let match;
      while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
        let link = match[1];
        if (link.includes('bing.com/ck/a?') || link.includes('bing.com/aclick?')) {
          link = this.unwrapBingUrl(link);
        }
        const title = (match[2] || '').replace(/<[^>]+>/g, '').trim();
        const snippet = (match[3] || '').replace(/<[^>]+>/g, '').trim();
        if (title && link) {
          results.push({ title, link, snippet });
        }
      }
      if (!results.length) {
        return 'No web search results found (Bing).';
      }
      return this.formatCustomResults(results, 'Bing');
    } catch (err) {
      logError('Bing search failed:', err?.stack || err);
      return 'No web search results found (Bing).';
    }
  }

  /**
   * Search using Google Scraper (simulating specialized client)
   * Based on reference implementation: GET request with asearch=arc and async params.
   * @param {string} query
   * @returns {Promise<string>}
   */
  async searchGoogle(query) {
    try {
      // 1. Generate async param (mocking the python logic)
      // logic: arc_id:srp_{random_token}_1{start:02},use_ac:true,_fmt:prog
      // random_token is ~23 chars. start=0 for page 1.
      const randomToken =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const asyncParam = `arc_id:srp_${randomToken}_100,use_ac:true,_fmt:prog`;

      // 2. Build URL
      const url = new URL('https://www.google.com/search');
      url.searchParams.set('q', query);
      url.searchParams.set('start', '0');
      url.searchParams.set('asearch', 'arc');
      url.searchParams.set('async', asyncParam);
      url.searchParams.set('ie', 'UTF-8');
      url.searchParams.set('oe', 'UTF-8');
      url.searchParams.set('hl', 'en-US');
      url.searchParams.set('lr', 'lang_en');

      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': userAgent,
        },
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logError(
          `[Google Scraper] fetch failed status=${response.status} ` +
            `statusText=${response.statusText} body=${errBody.slice(0, 500)}`,
        );
        throw new Error(`Google error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();

      // 3. Parse Results
      // The response for asearch=arc is often a JSON-like structure or HTML fragments wrapped in script callbacks.
      // However, standard Google HTML parsing might still work if the response is standard HTML.

      const results = [];
      // Fallback to the standard regex which is quite robust for standard Google HTML.
      const resultRegex =
        /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(?:\s*<h3[^>]*>(.*?)<\/h3>)[\\s\\S]*?(?:<div[^>]+class="[^"]*(VwiC3b|BNeawe)[^"]*"[^>]*>(.*?)<\/div>)/gi;

      let match;
      while ((match = resultRegex.exec(text)) !== null && results.length < 5) {
        const link = match[1];
        const title = (match[2] || '').replace(/<[^>]+>/g, '').trim();
        const snippet = (match[4] || '').replace(/<[^>]+>/g, '').trim();
        if (title && link) {
          results.push({ title, link, snippet });
        }
      }

      if (!results.length) {
        logDebug('[Google Scraper] No results found via regex.');
        return 'No web search results found (Google).';
      }

      return this.formatCustomResults(results, 'Google');
    } catch (err) {
      logError('Google search failed:', err?.stack || err);
      return 'No web search results found (Google).';
    }
  }

  /**
   * Search using DuckDuckGo HTML scraping (Free)
   * @param {string} query
   * @returns {Promise<string>}
   */
  async searchDuckDuckGo(query) {
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
    try {
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
      const apiRes = await fetch(apiUrl, { headers: { 'User-Agent': userAgent } });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const topics = data?.RelatedTopics || [];
        const jsonResults = topics
          .map((t) => {
            if (t.Topics) {
              return t.Topics.map((sub) => ({
                title: sub.Text || '',
                url: sub.FirstURL || '',
                snippet: sub.Text || '',
              }));
            }
            return { title: t.Text || '', url: t.FirstURL || '', snippet: t.Text || '' };
          })
          .flat()
          .filter((r) => r.title && r.url);
        if (jsonResults.length) {
          const formatted = this.formatCustomResults(
            jsonResults
              .slice(0, 5)
              .map((r) => ({ title: r.title, link: r.url, snippet: r.snippet })),
            'DuckDuckGo',
          );
          logDebug(`DuckDuckGo API results: ${jsonResults.length}`);
          return formatted;
        }
      }
    } catch (err) {
      logError('DuckDuckGo API search failed:', err);
    }

    try {
      const form = new URLSearchParams({ q: query, kl: 'us-en' });
      const response = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: form.toString(),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logError(
          `[DuckDuckGo] HTML fetch failed status=${response.status} ` +
            `statusText=${response.statusText} body=${errBody.slice(0, 500)}`,
        );
        throw new Error(`DuckDuckGo error: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      logDebug(
        `[DuckDuckGo] html len=${html.length} preview=${JSON.stringify(html.slice(0, 400))}`,
      );
      const parsed = this.parseDuckDuckGoHtml(html);
      return parsed;
    } catch (err) {
      logError('DuckDuckGo search failed:', err?.stack || err);
      return 'No web search results found (DuckDuckGo).';
    }
  }

  /**
   * Parse DuckDuckGo HTML results using Regex
   * @param {string} html
   * @returns {string}
   */
  parseDuckDuckGoHtml(html) {
    const results = [];
    const blockRegex =
      /<div[^>]+class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/(?:a|p)>)/gis;
    let match;
    while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
      let link = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = (match[3] || '').replace(/<[^>]+>/g, '').trim();

      if (link.includes('uddg=')) {
        try {
          const urlObj = new URL(link, 'https://duckduckgo.com');
          const uddg = urlObj.searchParams.get('uddg');
          if (uddg) {
            link = decodeURIComponent(uddg);
          }
        } catch (e) {
          // ignore parsing error, use original link
        }
      }

      results.push({ title, link, snippet });
    }

    if (results.length === 0) {
      return 'No web search results found (DuckDuckGo).';
    }

    return this.formatCustomResults(results, 'DuckDuckGo');
  }

  formatCustomResults(items, provider = 'Web Search') {
    let output = `Context from Web Search (${provider}):\n\n`;
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
