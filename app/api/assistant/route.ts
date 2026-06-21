import { NextRequest } from 'next/server';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 6;
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | string;
}

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystem(page: string, companyName?: string): string {
  const company = companyName || 'the company';
  return `You are ARIA — the intelligent AI assistant embedded inside the XERB enterprise management system for ${company}.

You have REAL-TIME access to the company's live data through tools. Always use tools when the user asks about specific records, counts, or data — never guess or make up numbers.

== SYSTEM MODULES ==
- Purchase Requests (PR): internal procurement requests from site/office
- Quotation Requests (QR): requests sent to suppliers for quotes
- Purchase Quotations (PQ): quotes received from suppliers
- Purchase Orders (PO / LPO): formal purchase orders issued to suppliers
- Goods Receiving (GRN): recording of received materials/goods
- Purchase Invoices: supplier invoices and payment tracking
- Projects: active construction projects (name, code, site)
- Suppliers: approved vendor list
- Products/Materials: company material & product catalog
- HR: employees, attendance, payroll, departments

== CURRENT CONTEXT ==
User is on page: ${page}

== LANGUAGE ==
Mirror the user's language exactly — Arabic ↔ English. Never mix unless the user does.

== BEHAVIOR ==
- Be direct, concise, professional
- Use tools proactively before answering data questions
- After tool results, summarize clearly in 2–3 lines max
- For navigation requests, always use the navigate_to tool
- If asked to create something, confirm details then use the create tool
- Never hallucinate data — say "let me check" and use a tool`;
}

// ── Tools ──────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'search_products',
    description: 'Search the product/material catalog by name, code, or SKU',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        category: { type: 'string', description: 'Optional category filter' },
        page_size: { type: 'number', description: 'Max results (default 8)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_projects',
    description: 'Get list of projects',
    input_schema: {
      type: 'object',
      properties: {
        is_active: { type: 'boolean', description: 'Filter active projects only (default true)' },
      },
    },
  },
  {
    name: 'get_suppliers',
    description: 'Get list of approved suppliers/vendors',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional search query' },
      },
    },
  },
  {
    name: 'get_pending_approvals',
    description: 'Get items pending approval across the procurement cycle',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['purchase_requests', 'purchase_invoices', 'purchase_orders', 'all'],
          description: 'Which module to check (use "all" for a dashboard view)',
        },
      },
      required: ['module'],
    },
  },
  {
    name: 'get_records',
    description: 'Get records from any procurement module with optional filters',
    input_schema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['purchase_requests', 'purchase_orders', 'purchase_quotations', 'quotation_requests', 'goods_receiving', 'purchase_invoices'],
          description: 'Which module to query',
        },
        status: { type: 'string', description: 'Filter by status (e.g. pending, approved, draft)' },
        search: { type: 'string', description: 'Search query' },
        page_size: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['module'],
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate the user to a specific page in the ERP system',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Route path (e.g. /purchase-requests, /purchase-orders/42)' },
        label: { type: 'string', description: 'Human-readable destination name' },
      },
      required: ['path', 'label'],
    },
  },
  {
    name: 'create_purchase_request',
    description: 'Create a new purchase request in the system',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'number', description: 'Project ID' },
        title: { type: 'string', description: 'Request title' },
        required_by: { type: 'string', description: 'Required by date (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['project_id', 'title'],
    },
  },
];

// ── Tool executor ──────────────────────────────────────────────────────────────
const MODULE_PATHS: Record<string, string> = {
  purchase_requests:   'purchase-requests',
  purchase_orders:     'purchase-orders',
  purchase_quotations: 'purchase-quotations',
  quotation_requests:  'quotation-requests',
  goods_receiving:     'goods-receiving',
  purchase_invoices:   'purchase-invoices',
};

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  authToken: string,
): Promise<{ data: unknown; summary: string; nav?: string }> {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:9000/api').replace(/\/$/, '');
  const headers: Record<string, string> = { Authorization: authToken, 'Content-Type': 'application/json' };

  const get = async (url: string) => {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json();
  };

  try {
    switch (name) {
      case 'search_products': {
        const qs = new URLSearchParams({ search: String(input.query), page_size: String(input.page_size ?? 8) });
        if (input.category) qs.set('category', String(input.category));
        const d = await get(`${base}/products/?${qs}`);
        const rows = (d.results ?? []).slice(0, 10).map((p: Record<string, unknown>) => ({
          id: p.id, name: p.name, code: p.code, unit: p.unit, category: p.category,
        }));
        return { data: rows, summary: `Found ${d.count ?? 0} products, showing ${rows.length}` };
      }

      case 'get_projects': {
        const qs = new URLSearchParams({ page_size: '30' });
        if (input.is_active !== false) qs.set('is_active', 'true');
        const d = await get(`${base}/projects/?${qs}`);
        const rows = (d.results ?? []).map((p: Record<string, unknown>) => ({
          id: p.id, name: p.name, code: p.code, status: p.status, location: p.location,
        }));
        return { data: rows, summary: `${d.count ?? 0} projects found` };
      }

      case 'get_suppliers': {
        const qs = new URLSearchParams({ page_size: '20' });
        if (input.search) qs.set('search', String(input.search));
        const d = await get(`${base}/suppliers/?${qs}`);
        const rows = (d.results ?? []).map((s: Record<string, unknown>) => ({
          id: s.id,
          name: (s.business_name ?? s.name) as string,
          email: s.contact_email,
          phone: s.contact_phone,
        }));
        return { data: rows, summary: `${d.count ?? 0} suppliers found` };
      }

      case 'get_pending_approvals': {
        const modules = input.module === 'all'
          ? ['purchase_requests', 'purchase_invoices', 'purchase_orders']
          : [String(input.module)];

        const summary: Record<string, number> = {};
        const details: Record<string, unknown[]> = {};
        for (const m of modules) {
          const path = MODULE_PATHS[m] ?? m.replace(/_/g, '-');
          const d = await get(`${base}/${path}/?status=pending&page_size=5`);
          summary[m] = d.count ?? 0;
          details[m] = (d.results ?? []).slice(0, 5);
        }
        const total = Object.values(summary).reduce((a, b) => a + b, 0);
        return { data: { summary, details }, summary: `${total} items pending approval` };
      }

      case 'get_records': {
        const path = MODULE_PATHS[String(input.module)] ?? String(input.module).replace(/_/g, '-');
        const qs = new URLSearchParams({ page_size: String(input.page_size ?? 10) });
        if (input.status) qs.set('status', String(input.status));
        if (input.search) qs.set('search', String(input.search));
        const d = await get(`${base}/${path}/?${qs}`);
        return { data: { count: d.count, results: d.results?.slice(0, 10) }, summary: `${d.count ?? 0} records found` };
      }

      case 'navigate_to':
        return {
          data: { path: input.path, label: input.label },
          summary: `Navigate to ${input.label}`,
          nav: String(input.path),
        };

      case 'create_purchase_request': {
        const r = await fetch(`${base}/purchase-requests/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            project: input.project_id,
            title: input.title,
            request_date: new Date().toISOString().split('T')[0],
            required_by: input.required_by ?? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            notes: input.notes ?? '',
            items: [],
          }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(JSON.stringify(err));
        }
        const created = await r.json();
        return {
          data: created,
          summary: `Purchase request created: ${created.code}`,
          nav: `/purchase-requests/${created.id}`,
        };
      }

      default:
        return { data: {}, summary: 'Unknown tool' };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: { error: msg }, summary: `Error: ${msg}` };
  }
}

// ── SSE helpers ────────────────────────────────────────────────────────────────
type SSEEvent =
  | { t: 'text'; v: string }
  | { t: 'tool_start'; name: string }
  | { t: 'tool_done'; name: string; summary: string }
  | { t: 'nav'; path: string; label: string }
  | { t: 'done' }
  | { t: 'error'; msg: string };

// ── Anthropic API call ─────────────────────────────────────────────────────────
async function callAnthropic(messages: Message[], system: string): Promise<AnthropicResponse> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      tools: TOOLS,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  return res.json() as Promise<AnthropicResponse>;
}

// ── Agentic loop ───────────────────────────────────────────────────────────────
async function runLoop(
  messages: Message[],
  authToken: string,
  currentPage: string,
  send: (e: SSEEvent) => void,
  companyName?: string,
): Promise<void> {
  const history: Message[] = [...messages];
  const system = buildSystem(currentPage, companyName);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await callAnthropic(history, system);

    history.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      for (const block of response.content) {
        if (block.type === 'text' && block.text) {
          const chunks = block.text.match(/[\s\S]{1,4}/g) ?? [];
          for (const chunk of chunks) {
            send({ t: 'text', v: chunk });
            await new Promise(r => setTimeout(r, 12));
          }
        }
      }
      return;
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: ToolResultBlock[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        send({ t: 'tool_start', name: block.name! });

        const result = await executeTool(
          block.name!,
          block.input as Record<string, unknown>,
          authToken,
        );

        send({ t: 'tool_done', name: block.name!, summary: result.summary });

        if (result.nav) {
          send({ t: 'nav', path: result.nav, label: result.summary });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id!,
          content: JSON.stringify(result.data),
        });
      }

      history.push({ role: 'user', content: toolResults as unknown as ContentBlock[] });
    }
  }

  send({ t: 'text', v: 'I reached the maximum reasoning steps. Please try a more specific question.' });
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 });
  }

  const { messages, authToken, currentPage, companyName } = await req.json() as {
    messages: Message[];
    authToken: string;
    currentPage: string;
    companyName?: string;
  };

  if (!authToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: SSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };

      try {
        await runLoop(messages, authToken, currentPage || '/', send, companyName);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send({ t: 'error', msg });
      } finally {
        send({ t: 'done' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
