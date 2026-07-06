import { tool } from "ai";
import { z } from "zod";
import type { ToolExecutor } from "./tool-executor"
import { executeShell } from "./tools/shell-tool";
import Firecrawl from "@mendable/firecrawl-js";

// TypeScript types for web search results
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

export function createAgentTools(executor: ToolExecutor) {
    console.log("========================");
    console.log("TOOLS REGISTERED");
    console.log("========================");
    
    // Firecrawl client singleton
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

    function clip(s: string, n = 8000): string {
        return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
    }

    // Helper to scrape a single URL with error handling
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
                markdown: clip(markdown, 5000), // Clip per page to 5000 chars
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

    // Log all registered tools
    const tools = {
      web_search: tool({
        description: "Search the internet for recent or factual information. Performs Firecrawl search, then scrapes the top 3-5 pages in parallel to return full markdown content with citations. Use for latest news, current events, sports, weather, factual information unavailable in context, product information, company information, stock prices, cryptocurrency prices, and live data.",
        inputSchema: z.object({
          query: z.string().min(1).describe("Search query"),
          limit: z.number().int().min(1).max(10).optional().default(5),
          scrapeCount: z.number().int().min(1).max(5).optional().default(3).describe("Number of top pages to scrape (1-5)"),
        }),
        execute: async ({ query, limit, scrapeCount }) => {
          const startTime = Date.now();
          console.log(`[web_search] Searching for: "${query}"`);
          
          const client = getFirecrawlClient();
          const res = await client.search(query, {
            limit,
            sources: ["web"],
          });

          const items = (res.web ?? []).slice(0, limit);
          const urlsToScrape = items.slice(0, scrapeCount).map((d: any) => d.url).filter(Boolean);
          
          console.log(`[web_search] Found ${items.length} results, scraping ${urlsToScrape.length} pages`);
          
          // Parallel scraping
          const scrapePromises = urlsToScrape.map(url => scrapeUrl(url));
          const scrapedPages = await Promise.all(scrapePromises);
          
          const successful = scrapedPages.filter(p => p.success);
          const failed = scrapedPages.filter(p => !p.success);
          
          console.log(`[web_search] Scraped ${successful.length} pages successfully, ${failed.length} failed`);
          
          const executionTime = Date.now() - startTime;
          console.log(`[web_search] Completed in ${executionTime}ms`);
          
          // Format results for LLM
          let output = `Search Query: ${query}\n\n`;
          output += `Sources (${successful.length} scraped):\n\n`;
          
          successful.forEach((page, i) => {
            output += `${i + 1}. ${page.title}\n   ${page.url}\n\n${page.markdown}\n\n---\n\n`;
          });
          
          if (failed.length > 0) {
            output += `\nFailed to scrape ${failed.length} pages:\n`;
            failed.forEach((page, i) => {
              output += `  - ${page.url}: ${page.error}\n`;
            });
          }
          
          return clip(output, 12000); // Total limit of 12000 chars
        },
      }),

      web_scrape: tool({
        description: "Scrape a single webpage into markdown. Use when you need the full content of a specific URL. Returns title, URL, and markdown content.",
        inputSchema: z.object({
          url: z.string().url().describe("URL to scrape"),
        }),
        execute: async ({ url }) => {
          const startTime = Date.now();
          console.log(`[web_scrape] Scraping: "${url}"`);
          
          const result = await scrapeUrl(url);
          
          const executionTime = Date.now() - startTime;
          console.log(`[web_scrape] Completed in ${executionTime}ms, success: ${result.success}`);
          
          if (!result.success) {
            return `Failed to scrape ${url}: ${result.error}`;
          }
          
          let output = `Title: ${result.title}\nURL: ${result.url}\n\n${result.markdown}`;
          return clip(output, 10000);
        },
      }),

      read_file: tool({
        description:
          "Read a text file from the workspace. Use a path relative to the project root.",
        inputSchema: z.object({
          path: z.string().describe("Relative file path"),
        }),
        execute: async ({ path: p }) => executor.readFile(p),
      }),
  
      create_file: tool({
        description:
          "Stage creation of a new file (not written until the user approves).",
        inputSchema: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path: p, content }) => executor.createFile(p, content),
      }),
  
      modify_file: tool({
        description:
          "Stage a full-file replacement for an existing file (pending approval).",
        inputSchema: z.object({
          path: z.string(),
          content: z.string().describe("Complete new file contents"),
        }),
        execute: async ({ path: p, content }) => executor.modifyFile(p, content),
      }),
  
      delete_file: tool({
        description: "Stage deletion of a file (pending approval).",
        inputSchema: z.object({
          path: z.string(),
        }),
        execute: async ({ path: p }) => executor.deleteFile(p),
      }),
  
      create_folder: tool({
        description:
          "Stage creation of a directory tree (pending approval). Uses mkdir -p on apply.",
        inputSchema: z.object({
          path: z.string().describe("Relative directory path"),
        }),
        execute: async ({ path: p }) => executor.createFolder(p),
      }),
  
      list_files: tool({
        description: "List files and directories under a path.",
        inputSchema: z.object({
          path: z.string(),
          recursive: z.boolean().optional().default(false),
        }),
        execute: async ({ path: p, recursive }) =>
          executor.listFiles(p, recursive),
      }),
  
      search_files: tool({
        description:
          'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
        inputSchema: z.object({
          root: z.string().describe("Directory to search, relative to root"),
          pattern: z
            .string()
            .describe("Glob-like pattern using * and ** (forward slashes)"),
          content_contains: z.string().optional(),
        }),
        execute: async ({ root, pattern, content_contains }) =>
          executor.searchFiles(root, pattern, content_contains),
      }),
  
      analyze_codebase: tool({
        description:
          "Summarize structure: file counts, size, extensions. Read-only.",
        inputSchema: z.object({
          path: z.string().default("."),
        }),
        execute: async ({ path: p }) => executor.analyzeCodebase(p),
      }),
  
      execute_shell: tool({
        description:
          "Run a shell command in the workspace. Approval is enforced by shell risk policy.",
        inputSchema: z.object({
          command: z.string().describe("Single shell command to execute"),
        }),
        execute: async ({ command }) =>
          executeShell(command, { cwd: process.cwd() }),
      }),
  
      list_skills: tool({
        description:
          "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
        inputSchema: z.object({}),
        execute: async () => executor.listSkills(),
      }),
  
      read_skill: tool({
        description:
          "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
        inputSchema: z.object({
          path: z.string(),
        }),
        execute: async ({ path: p }) => executor.readSkill(p),

        
      })
    };
    
    console.log("Registered tools:");
    Object.keys(tools).forEach(name => console.log(`- ${name}`));
    console.log("========================");
    
    return tools;
  }