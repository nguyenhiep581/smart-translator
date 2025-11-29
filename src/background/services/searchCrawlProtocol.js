import { error as logError, debug as logDebug } from '../../utils/logger.js';

const MAX_SNIPPET_CHARS = 1800;
const MAX_FETCH_BYTES = 200000; // ~200kb safeguard

const stripHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    logError(`Crawler fetch failed ${res.status} for ${url}`);
    return '';
  }
  const contentType = res.headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html');
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return isHtml ? stripHtml(text) : text;
  }

  let received = 0;
  let chunks = '';
  let reading = true;
  while (reading) {
    const { done, value } = await reader.read();
    if (done) {
      reading = false;
      break;
    }
    received += value.length;
    if (received > MAX_FETCH_BYTES) {
      reading = false;
      break;
    }
    chunks += new TextDecoder().decode(value, { stream: true });
  }
  const text = chunks;
  return isHtml ? stripHtml(text) : text;
}

async function crawlerFetch(url) {
  try {
    const text = await fetchText(url);
    if (!text) {
      return '';
    }
    const normalized = text.slice(0, 400).toLowerCase();
    const errorSignals = ['not found', 'page not found', 'route not found', '404', 'forbidden'];
    if (errorSignals.some((sig) => normalized.includes(sig))) {
      return '';
    }
    return text.slice(0, MAX_SNIPPET_CHARS);
  } catch (err) {
    logError('Crawler fetch failed', err);
    return '';
  }
}

async function duckduckgoSearch(query) {
  // DuckDuckGo Instant Answer API
  // This is the primary requested method to avoid 403 blocks on HTML scraping.
  // Note: This API is designed for "answers" (definitions, facts), not deep SERP links.
  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const apiRes = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (apiRes.ok) {
      const data = await apiRes.json();
      const results = [];

      // 1. Direct Abstract/Answer
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || 'Instant Answer',
          url: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }

      // 2. "Results" array (External links, usually explicit definitions/official sites)
      if (Array.isArray(data.Results)) {
        data.Results.forEach((r) => {
          if (r.FirstURL && r.Text) {
            results.push({
              title: r.Text, // API often puts title/desc in Text
              url: r.FirstURL,
              snippet: r.Text,
            });
          }
        });
      }

      // 3. "RelatedTopics" (The bulk of "search-like" results)
      const topics = data.RelatedTopics || [];
      const topicResults = topics
        .map((t) => {
          if (t.Topics) {
            // Nested topics
            return t.Topics.map((sub) => ({
              title: sub.Text || '',
              url: sub.FirstURL || '',
              snippet: sub.Text || '',
            }));
          }
          return {
            title: t.Text || '',
            url: t.FirstURL || '',
            snippet: t.Text || '',
          };
        })
        .flat()
        .filter((r) => r.title && r.url);

      results.push(...topicResults);

      const finalResults = results.slice(0, 8); // Return slightly more if available

      return finalResults;
    } else {
      logError(`DuckDuckGo API error: ${apiRes.status}`);
    }
  } catch (err) {
    logError('DuckDuckGo API search failed', err);
  }

  return [];
}

function unwrapBingUrl(rawUrl) {
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
  } catch (_) {
    return rawUrl;
  }
}

async function bingSearch(query) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&setlang=en-us&cc=us`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logError(
        `[Bing] fetch failed status=${res.status} statusText=${res.statusText} body=${body.slice(
          0,
          500,
        )}`,
      );
      return [];
    }
    const html = await res.text();
    logDebug(`[Bing] html len=${html.length} preview=${JSON.stringify(html.slice(0, 800))}`);
    logDebug('[Bing] Response Text:', html);
    const results = [];
    // Updated regex to handle b_caption wrapper around the snippet paragraph
    const blockRegex =
      /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>(.*?)<\/p>)?/gi;
    let match;
    while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
      let link = match[1];
      if (link.includes('bing.com/ck/a?') || link.includes('bing.com/aclick?')) {
        link = unwrapBingUrl(link);
      }
      const title = (match[2] || '').replace(/<[^>]+>/g, '').trim();
      const snippet = (match[3] || '').replace(/<[^>]+>/g, '').trim();
      if (title && link) {
        results.push({ title, url: link, snippet });
      }
    }
    return results;
  } catch (err) {
    logError('Bing search failed', err);
    return [];
  }
}

async function googleSearch(query) {
  try {
    // 1. Generate async param (mocking the python logic)
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
      return [];
    }

    const text = await response.text();
    logDebug(`[Google Scraper] response len=${text.length}`);
    logDebug('[Google Scraper] Response Text:', text);

    const results = [];

    // Strategy 1: Try to extract the `pmc` JSON object which often contains rich results
    try {
      const pmcMatch = text.match(/var\s+pmc\s*=\s*'({.*})';/);
      if (pmcMatch && pmcMatch[1]) {
        // The JSON string inside pmc might be hex-escaped (e.g. \x22). JSON.parse handles standard escapes,
        // but if it's raw JS string escapes, we might need to be careful.
        // The log shows standard JSON structure.
        // Use a safe parser or just try JSON.parse
        // const pmcJson = JSON.parse(
        //   pmcMatch[1].replace(/\\x([0-9A-F]{2})/g, (_, hex) =>
        //     String.fromCharCode(parseInt(hex, 16)),
        //   ),
        // );
        // Navigate valid keys to find results (heuristics based on common structures)
        // This is complex as the structure varies. Let's look for "organic" results.
        // For now, let's rely on the Regex fallback which is often more stable for scraping specific DOM elements
        // even if they are embedded in strings.
      }
    } catch (e) {
      // ignore
    }

    // Strategy 2: Regex on the raw text to find standard result anchors
    // The raw text contains HTML strings.
    // Standard regex might fail if HTML is escaped.
    // Let's try to match unescaped links first, then escaped.

    // Strategy 2: Regex on the raw text to find standard result anchors

    // The raw text contains HTML strings.

    // Standard regex might fail if HTML is escaped.

    // Let's try to match unescaped links first, then escaped.

    // This regex looks for standard <a href="..."><h3>...</h3></a> patterns

    const resultRegex =
      /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(?:\s*<h3[^>]*>(.*?)<\/h3>)[\s\S]*?(?:<div[^>]+class="[^"]*(VwiC3b|BNeawe)[^"]*"[^>]*>(.*?)<\/div>)/gi;

    let match;

    while ((match = resultRegex.exec(text)) !== null && results.length < 5) {
      const link = match[1];

      const title = (match[2] || '').replace(/<[^>]+>/g, '').trim();

      const snippet = (match[4] || '').replace(/<[^>]+>/g, '').trim();

      if (title && link) {
        results.push({ title, url: link, snippet });
      }
    }

    // Strategy 3: If direct HTML parsing failed, checking for escaped HTML in JSON

    if (!results.length) {
      // Look for url/title patterns inside the text broadly

      // This is a fallback heuristic for when the response is heavily obfuscated

      // Matching pattern: ["http...", "Title", ...]

      // This is risky but better than nothing.

      // Let's look for the specific data-ved pattern seen in the log:

      // <div ... data-ved="..."> ... <a href="..."> ...

      // The log shows: ["uYQqac76OfDk1e8Prtrz4AQ","2332",null,[3,1,5,1,0]]c;[2,null,"0"]869;<div decode-data-ved="1" ...

      // The content is mixed.

      // Let's try a broader regex that handles potential escaped quotes

      // We reuse the logic but with unescaped text

      const unescaped = text
        .replace(/\\"/g, '"')
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>');

      let bMatch;

      // Reset regex state

      resultRegex.lastIndex = 0;

      while ((bMatch = resultRegex.exec(unescaped)) !== null && results.length < 5) {
        const link = bMatch[1];

        const title = (bMatch[2] || '').replace(/<[^>]+>/g, '').trim();

        const snippet = (bMatch[4] || '').replace(/<[^>]+>/g, '').trim();

        if (title && link && !link.includes('google.com')) {
          results.push({ title, url: link, snippet });
        }
      }
    }

    // Strategy 3: If direct HTML parsing failed, checking for escaped HTML in JSON
    if (!results.length) {
      // Look for url/title patterns inside the text broadly
      // This is a fallback heuristic for when the response is heavily obfuscated
      // Matching pattern: ["http...", "Title", ...]
      // This is risky but better than nothing.

      // Let's look for the specific data-ved pattern seen in the log:
      // <div ... data-ved="..."> ... <a href="..."> ...
      // The log shows: ["uYQqac76OfDk1e8Prtrz4AQ","2332",null,[3,1,5,1,0]]c;[2,null,"0"]869;<div decode-data-ved="1" ...
      // The content is mixed.

      // Let's try a broader regex that handles potential escaped quotes
      // const broadRegex = /href=\\?"(https?:\/\/[^"\\]+)\\?"[^>]*>(?:.*?)<h3[^>]*>(.*?)<\/h3>(?:.*?)<div[^>]*>(.*?)<\/div>/gi;
      let bMatch;
      // We need to unescape the text first to make it standard HTML-like
      const unescaped = text
        .replace(/\\"/g, '"')
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>');

      while ((bMatch = resultRegex.exec(unescaped)) !== null && results.length < 5) {
        const link = bMatch[1];
        const title = (bMatch[2] || '').replace(/<[^>]+>/g, '').trim();
        const snippet = (bMatch[4] || '').replace(/<[^>]+>/g, '').trim();
        if (title && link && !link.includes('google.com')) {
          results.push({ title, url: link, snippet });
        }
      }
    }

    if (!results.length) {
      logDebug(
        '[Google Scraper] No results via specialized method. Falling back to standard search.',
      );

      // Fallback: Standard HTML Search
      // This often works better when the async endpoint returns metadata/voice-search states
      const fallbackUrl = new URL('https://www.google.com/search');
      fallbackUrl.searchParams.set('q', query);
      fallbackUrl.searchParams.set('hl', 'en');
      fallbackUrl.searchParams.set('gl', 'us'); // geolocation

      const fallbackRes = await fetch(fallbackUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (fallbackRes.ok) {
        const fallbackText = await fallbackRes.text();

        // Standard Google HTML Regex
        // Matches: <div class="g"> ... <a href="..."> ... <h3 ...>Title</h3>
        // We use a broader regex that catches title and link usually present in standard SERP
        const fallbackRegex =
          /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(?:.*?)<h3[^>]*>(.*?)<\/h3>(?:.*?)<div[^>]*>(.*?)<\/div>/gi;

        // Reset regex just in case
        fallbackRegex.lastIndex = 0;

        let fMatch;
        while ((fMatch = fallbackRegex.exec(fallbackText)) !== null && results.length < 5) {
          const link = fMatch[1];
          const title = (fMatch[2] || '').replace(/<[^>]+>/g, '').trim();
          const snippet = (fMatch[3] || '').replace(/<[^>]+>/g, '').trim();

          // Filter out Google internal links
          if (title && link && !link.includes('.google.') && !link.startsWith('/')) {
            results.push({ title, url: link, snippet });
          }
        }
      }
    }

    return results;
  } catch (err) {
    logError('Google search failed', err);
    return [];
  }
}

async function searchWeb(query, webConfig) {
  // 1. Try explicit provider if set
  if (webConfig?.provider === 'google') {
    return googleSearch(query);
  }
  if (webConfig?.provider === 'bing') {
    return bingSearch(query);
  }

  // 2. Default to DuckDuckGo API only
  // User requested removal of fallback chain to Google/Bing due to issues.
  return duckduckgoSearch(query);
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map((u) => (u.startsWith('http') ? u : `http://${u}`));
}

function buildSearchPlan(userMessage) {
  const urls = extractUrls(userMessage);
  const cleaned = userMessage.replace(/\s+/g, ' ').trim();
  const tokens = cleaned.split(' ').filter((t) => t.length > 3);
  const keywords = tokens.slice(0, 8).join(' ');
  const queries = urls.length ? [] : [cleaned, keywords].filter(Boolean);
  return { urls, queries };
}

function normalizePlan(plan, userMessage) {
  const fallback = buildSearchPlan(userMessage);
  if (!plan) {
    return fallback;
  }
  const urls = Array.isArray(plan.urls) ? plan.urls.filter(Boolean) : [];
  const queries = Array.isArray(plan.queries) ? plan.queries.filter(Boolean) : [];
  // If nothing usable from LLM, fallback to heuristic
  if (!urls.length && !queries.length) {
    return fallback;
  }
  return {
    urls: urls.length ? urls : fallback.urls,
    queries: queries.length ? queries : fallback.queries,
  };
}

export async function runSearchCrawlProtocol(userMessage, webConfig, notify, llmPlan) {
  const onStatus = notify || (() => {});
  onStatus('Analyzing request…');

  const plan = normalizePlan(llmPlan, userMessage);
  const contextParts = [];

  // Crawl explicit URLs first
  for (const url of plan.urls) {
    onStatus(`Crawling ${url}`);
    const content = await crawlerFetch(url);
    if (content) {
      contextParts.push(`Crawl: ${url}\n${content}`);
    }
  }

  // Search queries
  for (const query of plan.queries) {
    onStatus(`Searching DuckDuckGo for "${query}"`);
    const results = await searchWeb(query, webConfig);
    if (!results.length) {
      contextParts.push(`Search "${query}" returned no results.`);
      continue;
    }
    const formatted = results
      .map((r, idx) => `${idx + 1}. ${r.title}\n   Source: ${r.url}\n   Snippet: ${r.snippet}`)
      .join('\n');
    contextParts.push(`Search results for "${query}":\n${formatted}`);

    // Optionally crawl top result for depth
    const top = results[0];
    if (top?.url) {
      onStatus(`Crawling top result ${top.url}`);
      const crawlText = await crawlerFetch(top.url);
      if (crawlText) {
        contextParts.push(`Crawl: ${top.url}\n${crawlText}`);
      }
    }
  }

  onStatus('Assembling context…');
  return contextParts.join('\n\n');
}

export const searchTools = {
  duckduckgo: { search: duckduckgoSearch },
  bing: { search: bingSearch },
  google: { search: googleSearch },
  crawler: { fetch: crawlerFetch },
};
