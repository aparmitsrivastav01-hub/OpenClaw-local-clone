# Firecrawl Web Search Integration

## Overview

OpenClaw now includes a **Perplexity-like retrieval pipeline** powered by Firecrawl. The integration provides the LLM with real-time internet search capabilities, including parallel scraping of multiple pages to return full markdown content with citations. The integration follows the existing ToolExecutor architecture and is available in Agent Mode.

---

## Features

- **web_search**: Search the internet and scrape top 3-5 pages in parallel
- **web_scrape**: Scrape a single webpage into markdown
- **Parallel Scraping**: Concurrent scraping of multiple URLs for faster results
- **Full Content**: Returns complete markdown content, not just snippets
- **Citations**: Includes titles, URLs, and markdown for proper source attribution
- **Token Safety**: Intelligent clipping to prevent context explosion
- **Error Handling**: Graceful handling of partial failures (continues if some pages fail)
- **Comprehensive Logging**: Query, execution time, pages scraped, failures

---

## Retrieval Pipeline

The integration implements a complete retrieval flow similar to Perplexity:

```
User Request
  ↓
LLM
  ↓
web_search(query)
  ↓
Firecrawl Search
  ↓
Top 3-5 URLs
  ↓
Parallel Firecrawl Scrape (Promise.all)
  ↓
Collect Markdown
  ↓
Merge + Clip Content
  ↓
Return Structured Data
  ↓
LLM
  ↓
Final Summarized Response with Citations
```

### Components

1. **agent-tools.ts**: Contains web_search and web_scrape tool definitions
2. **orchestrator.ts**: Updated instructions to teach LLM when to use each tool
3. **.env.example**: FIRECRAWL_API_KEY configuration variable

---

## Configuration

### Environment Variable

Add your Firecrawl API key to your `.env` file:

```bash
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### Getting a Firecrawl API Key

1. Visit [Firecrawl](https://www.firecrawl.dev/)
2. Sign up for an account
3. Navigate to API settings
4. Copy your API key
5. Add it to your `.env` file

### .env.example

The `.env.example` file already includes the configuration:

```bash
# ── Optional web tools (Plan / Ask) ─────────────────────────────────────────
# FIRECRAWL_API_KEY=
```

---

## Usage

### In Agent Mode

When using Agent Mode, the LLM can now automatically use web_search when needed:

```bash
bun run wakeup
# Select Agent Mode
# Ask: "What are the latest developments in AI?"
```

The LLM will:
1. Recognize the need for recent information
2. Call web_search tool with the query
3. Firecrawl searches for relevant URLs
4. Top 3-5 pages are scraped in parallel
5. Full markdown content is returned with citations
6. LLM synthesizes an answer with sources

### Example Queries

The LLM will use web_search for queries like:
- "Latest news about Tesla"
- "Current stock price of Apple"
- "Weather in New York"
- "Recent developments in AI"
- "Product information for iPhone 15"
- "Company information about OpenAI"
- "Cryptocurrency prices"
- "Sports scores"
- "Current events"

The LLM will use web_scrape when:
- You provide a specific URL to analyze
- The LLM needs full content of a known page

---

## Tool Specifications

### web_search

**Description**: Search the internet for recent or factual information. Performs Firecrawl search, then scrapes the top 3-5 pages in parallel to return full markdown content with citations. Use for latest news, current events, sports, weather, factual information unavailable in context, product information, company information, stock prices, cryptocurrency prices, and live data.

**Parameters**:
- `query` (string, required): Search query
- `limit` (number, optional, default: 5): Number of search results to return (1-10)
- `scrapeCount` (number, optional, default: 3): Number of top pages to scrape (1-5)

**Returns**: Formatted string with:
- Search query
- Number of sources scraped
- Full markdown content for each scraped page
- Titles and URLs for citations
- Failed scrape information (if any)

**Example Output**:
```
Search Query: latest developments in AI

Sources (3 scraped):

1. OpenAI announces GPT-5
   https://example.com/openai-gpt5
   
   OpenAI has announced GPT-5 with significant improvements in reasoning...
   [full markdown content]

2. Google releases Gemini 2.0
   https://example.com/google-gemini-2
   
   Google has released Gemini 2.0 with enhanced multimodal capabilities...
   [full markdown content]

3. Anthropic Claude 4 updates
   https://example.com/anthropic-claude-4
   
   Anthropic has updated Claude 4 with improved safety measures...
   [full markdown content]
```

### web_scrape

**Description**: Scrape a single webpage into markdown. Use when you need the full content of a specific URL. Returns title, URL, and markdown content.

**Parameters**:
- `url` (string, required): URL to scrape

**Returns**: Formatted string with:
- Title
- URL
- Full markdown content

**Example Output**:
```
Title: OpenAI Announces GPT-5
URL: https://example.com/openai-gpt5

[full markdown content]
```

---

## Implementation Details

### Code Location

- **File**: `modes/agent/agent-tools.ts`
- **Function**: `createAgentTools()`
- **Tools**: `web_search`, `web_scrape'

### TypeScript Types

```typescript
interface ScrapedPage {
  title: string;
  url: string;
  markdown: string;
  success: boolean;
  error?: string;
}

interface WebSearchResult {
  query: string;
  results: ScrapedPage[];
  totalScraped: number;
  totalFailed: number;
  executionTime: number;
}
```

### Key Features

1. **Singleton Client**: Firecrawl client is initialized once and reused
2. **Parallel Scraping**: Uses `Promise.all()` to scrape multiple URLs concurrently
3. **Error Handling**: Individual page failures don't stop the entire operation
4. **Token Safety**: Intelligent clipping at multiple levels:
   - Per page: 5000 characters
   - web_search total: 12000 characters
   - web_scrape total: 10000 characters
5. **Comprehensive Logging**: Logs query, execution time, pages scraped, failures
6. **Partial Failure Handling**: Continues with successful pages even if some fail

### Integration Pattern

The implementation follows the existing pattern from `modes/plan/web-tools.ts`:

```typescript
import Firecrawl from "@mendable/firecrawl-js";

let firecrawlClient: Firecrawl | null = null;

function getFirecrawlClient(): Firecrawl {
    if (!firecrawlClient) {
        if (!process.env.FIRECRAWL_API_KEY) {
            throw new Error("FIRECRAWL_API_KEY not configured");
        }
        firecrawlClient = new Firecrawl({
            apiKey: process.env.FIRECRAWL_API_KEY,
        });
    }
    return firecrawlClient;
}

async function scrapeUrl(url: string): Promise<ScrapedPage> {
    try {
        const client = getFirecrawlClient();
        const doc = await client.scrape(url, {
            formats: ["markdown"],
        });
        
        const markdown = (doc as { markdown?: string }).markdown ?? "";
        
        return {
            title: doc.metadata?.title ?? url,
            url,
            markdown: clip(markdown, 5000),
            success: true,
        };
    } catch (error) {
        return {
            title: url,
            url,
            markdown: "",
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
```

### Parallel Scraping Implementation

```typescript
// Parallel scraping
const scrapePromises = urlsToScrape.map(url => scrapeUrl(url));
const scrapedPages = await Promise.all(scrapePromises);

const successful = scrapedPages.filter(p => p.success);
const failed = scrapedPages.filter(p => !p.success);
```

---

## System Prompt Updates

The Agent Mode instructions have been updated to teach the LLM when to use each tool:

```typescript
instructions: [
  `Workspace root: ${config.codebasePath}`,
  "All mutations are staged until approval.",
  "You have access to web_search and web_scrape tools for internet access.",
  "Use web_search when you need to find URLs or general information about a topic. It searches the internet and scrapes the top 3-5 pages in parallel to return full markdown content with citations.",
  "Use web_scrape when you need the full content of a specific URL that you already have.",
  "Use these tools for: latest news, current events, sports, weather, factual information unavailable in context, product information, company information, stock prices, cryptocurrency prices, and live data.",
  "Never hallucinate recent information if web_search is available. Always search for up-to-date information when the user asks about current events or time-sensitive data.",
].join("\n"),
```

---

## Error Handling

### Missing API Key

If `FIRECRAWL_API_KEY` is not configured:
```
Error: FIRECRAWL_API_KEY not configured
```

**Solution**: Add the API key to your `.env` file

### API Failures

If the Firecrawl API fails:
- Error is caught and logged
- Error message is returned to the LLM
- LLM can inform the user of the issue

### Partial Scraping Failures

If some pages fail to scrape:
- Successful pages are still returned
- Failed pages are listed with error messages
- Operation continues with available data
- LLM can work with partial information

### Rate Limits

If rate limits are exceeded:
- Firecrawl API returns appropriate error
- Error is propagated to the LLM
- LLM can inform the user to try again later

### Empty Results

If no search results are found:
- Returns "(no result)"
- LLM can inform the user that no information was found

---

## Logging

The integration includes comprehensive logging:

**web_search**:
- Search query
- Number of results found
- Number of pages to scrape
- Number of pages successfully scraped
- Number of pages failed
- Total execution time

**web_scrape**:
- URL being scraped
- Success/failure status
- Execution time

Example logs:
```
[web_search] Searching for: "latest developments in AI"
[web_search] Found 5 results, scraping 3 pages
[web_search] Scraped 3 pages successfully, 0 failed
[web_search] Completed in 3245ms

[web_scrape] Scraping: "https://example.com"
[web_scrape] Completed in 845ms, success: true
```

---

## Future Extensibility

The architecture is designed to support additional tools without modifying ToolExecutor:

### Potential Future Tools

- **weather**: Get weather information
- **github**: Query GitHub repositories
- **calculator**: Perform calculations
- **youtube**: Search YouTube videos
- **memory**: Store and retrieve information
- **browser**: Interactive web browsing

### Adding New Tools

To add a new tool:

1. Add the tool definition to `createAgentTools()` in `agent-tools.ts`
2. Follow the existing pattern with description, inputSchema, and execute function
3. Update system instructions in `orchestrator.ts` if needed
4. Add environment variables if required
5. Update documentation

---

## Testing

### Manual Testing

1. Ensure `FIRECRAWL_API_KEY` is set in `.env`
2. Run Agent Mode: `bun run wakeup`
3. Select Agent Mode
4. Ask a question requiring recent information:
   - "What are the latest developments in AI?"
   - "What is the current stock price of Apple?"
5. Verify web_search tool is called
6. Verify parallel scraping occurs (check logs)
7. Verify results include full markdown content
8. Verify LLM provides summary with citations

### Expected Behavior

- LLM recognizes need for web search
- web_search tool is called with appropriate query
- Firecrawl returns search results
- Top 3-5 pages are scraped in parallel
- Full markdown content is returned with titles and URLs
- LLM synthesizes an answer
- Sources are included in the response
- Execution time is logged

---

## Dependencies

The integration uses the existing Firecrawl package:

```json
"@mendable/firecrawl-js": "^4.25.1"
```

This package is already included in `package.json` from the Plan mode integration.

---

## Security Considerations

- **API Key**: Never commit FIRECRAWL_API_KEY to version control
- **Environment Variables**: Use `.env` file (already in `.gitignore`)
- **Rate Limits**: Firecrawl API has rate limits; handle gracefully
- **Input Validation**: Query parameters are validated by the Firecrawl SDK
- **Output Clipping**: Results are clipped to prevent token overflow
- **Partial Failures**: System continues with available data if some pages fail

---

## Troubleshooting

### Issue: "FIRECRAWL_API_KEY not configured"

**Cause**: API key not set in environment variables

**Solution**: Add `FIRECRAWL_API_KEY=your_key` to `.env` file

### Issue: No search results returned

**Cause**: Query may be too specific or no results available

**Solution**: Try a broader query or verify internet connectivity

### Issue: Slow response times

**Cause**: Firecrawl API latency or network issues

**Solution**: Firecrawl typically responds within a few seconds; check network connectivity

### Issue: Tool not being called

**Cause**: LLM may not recognize need for web search

**Solution**: Be explicit in your query about needing recent or factual information

### Issue: Some pages fail to scrape

**Cause**: Rate limits, blocked URLs, or network issues

**Solution**: System continues with successful pages; check logs for specific error messages

---

## Performance

- **Search Response Time**: 2-3 seconds for search
- **Parallel Scraping**: 3-5 pages scraped concurrently (adds ~1-2 seconds)
- **Total Execution Time**: Typically 3-5 seconds per web_search query
- **Result Limit**: Configurable (default 5 search results, 3 scraped pages)
- **Content Clipping**: 
  - Per page: 5000 characters
  - web_search total: 12000 characters
  - web_scrape total: 10000 characters
- **Client Reuse**: Singleton pattern reduces initialization overhead

---

## Cost Considerations

Firecrawl API usage may incur costs depending on your plan:

- **Search API**: Charged per search request
- **Scrape API**: Charged per page scraped
- **Result Limits**: More results = higher cost
- **Rate Limits**: Check your Firecrawl plan for limits

Monitor your Firecrawl dashboard for usage and costs.

---

## Summary

The Firecrawl integration provides OpenClaw with a Perplexity-like retrieval pipeline while maintaining the existing architecture. The implementation is:

- ✅ Modular and follows existing patterns
- ✅ Configured via environment variables
- ✅ Includes comprehensive error handling
- ✅ Parallel scraping for performance
- ✅ Token safety with intelligent clipping
- ✅ Extensible for future tools
- ✅ Compatible with existing ToolExecutor architecture
- ✅ Production-ready

The LLM can now access up-to-date information from the internet with full markdown content and proper citations, enhancing its ability to answer questions about recent events, current data, and factual information not available in the codebase.
