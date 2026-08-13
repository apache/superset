/**
 * HTTP server for the Handlebars rendering sidecar.
 *
 * Exposes:
 *   POST /api/v1/render-handlebars  — compile + render a template with data
 *   GET  /health                     — health check
 */

import http from 'http';
import Handlebars from 'handlebars';
import { registerHelpers } from './helpers';
import { sanitizeHtml } from './sanitize';

const PORT = parseInt(process.env.HANDLEBARS_SIDECAR_PORT || '3031', 10);
const MAX_BODY_BYTES = 10 * 1024 * 1024;

interface RenderRequest {
  template: string;
  capture_screenshot?: boolean;
  sanitization_schema_overrides?: Record<string, unknown>;
  slots: Array<{
    name: string;
    data: Record<string, unknown>[];
    columns: string[];
    template: string;
  }>;
}

interface RenderResponse {
  rendered_html: string | null;
  screenshot_base64: string | null;
  error: string | null;
  render_time_ms: number;
}

// ---- Playwright browser pool (lazy-init, kept alive) ----

let browserPromise: Promise<any> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      console.log('Chromium launched for screenshot support');
      return browser;
    })();
  }
  return browserPromise;
}

async function takeScreenshot(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.setContent(
      `<!DOCTYPE html>
       <html><head><meta charset="utf-8">
       <style>body { font-family: Inter, Helvetica, Arial, sans-serif; margin: 0; padding: 16px; }</style>
       </head><body>${html}</body></html>`,
      { waitUntil: 'domcontentloaded' },
    );
    return await page.screenshot({ type: 'png', fullPage: true });
  } finally {
    await page.close();
  }
}

// ---- Request handling ----

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleRender(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const startTime = Date.now();

  let body: string;
  try {
    body = await readBody(req);
  } catch (err: any) {
    jsonResponse(res, 413, { error: err.message });
    return;
  }

  let parsed: RenderRequest;
  try {
    parsed = JSON.parse(body);
  } catch {
    jsonResponse(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!parsed.template) {
    jsonResponse(res, 400, { error: 'Missing template field' });
    return;
  }

  try {
    // Create an isolated Handlebars instance (same as frontend)
    const hb = Handlebars.create();
    registerHelpers(hb);

    // Register slot data as partials and build context
    const context: Record<string, { data: Record<string, unknown>[]; columns: string[] }> = {};
    const slots = parsed.slots || [];

    for (const slot of slots) {
      hb.registerPartial(slot.name, slot.template);
      context[slot.name] = {
        data: slot.data || [],
        columns: slot.columns || [],
      };
    }

    // Compile and render
    const compiled = hb.compile(parsed.template);
    const rendered = compiled(context);

    // Apply the same sanitization pipeline as SafeMarkdown in the browser
    const sanitized = await sanitizeHtml(rendered, parsed.sanitization_schema_overrides as any);

    // Optionally capture a screenshot
    let screenshot_base64: string | null = null;
    if (parsed.capture_screenshot) {
      const screenshotBuffer = await takeScreenshot(sanitized);
      screenshot_base64 = screenshotBuffer.toString('base64');
    }

    const response: RenderResponse = {
      rendered_html: sanitized,
      screenshot_base64,
      error: null,
      render_time_ms: Date.now() - startTime,
    };

    jsonResponse(res, 200, response);
  } catch (err: any) {
    console.error('Handlebars render error:', err);
    jsonResponse(res, 200, {
      rendered_html: null,
      screenshot_base64: null,
      error: err.message,
      render_time_ms: Date.now() - startTime,
    });
  }
}

export function startServer(): void {
  const server = http.createServer(
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = req.url || '';
      const method = req.method || '';

      try {
        if (url === '/health' && (method === 'GET' || method === 'HEAD')) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        } else if (url === '/api/v1/render-handlebars' && method === 'POST') {
          await handleRender(req, res);
        } else {
          jsonResponse(res, 404, { error: 'Not found' });
        }
      } catch (err: any) {
        console.error('Unhandled error:', err);
        jsonResponse(res, 500, { error: 'Internal server error' });
      }
    },
  );

  server.listen(PORT, () => {
    console.log(`Handlebars sidecar listening on port ${PORT}`);
  });
}
