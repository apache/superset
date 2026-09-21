/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { ResolvedFilter } from '../filterVocabulary';
import type {
  DataBindingSpec,
  DataRow,
  QueryDataResult,
  SavedWidget,
  WidgetDataClient,
  WidgetRef,
} from '../types';
import {
  WidgetMcpError,
  toWidgetMcpError,
  toolErrorFromPayload,
  widgetMcpError,
} from './errors';

/** The slice of the artifact runtime's `mcp` capability this client uses. */
export interface ArtifactMcp {
  callTool(
    server: string,
    tool: string,
    input?: unknown,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

/**
 * `widget-tools`: Superset's widget MCP tools, which run saved and inline
 * widgets exactly like the REST widget API.
 * `query-dataset`: the long-standing `query_dataset` tool, so inline widgets
 * work against deployments that predate the widget tools.
 */
export type McpStrategy = 'widget-tools' | 'query-dataset';

export interface McpWidgetClientOptions {
  mcp: ArtifactMcp | null | Promise<ArtifactMcp | null>;
  /** The connector's display name, as named in the artifact's manifest. */
  server: string;
  strategy?: McpStrategy;
  /** Call through the server's `call_tool` meta-tool instead of the tool itself. */
  proxy?: boolean;
  /** Delay before the single retry of a retryable read; defaults to the server's hint or ~0.5 s. */
  retryDelayMs?: number;
}

/** Tool names and argument shapes in one place, so a server-side rename is a one-line change. */
export const MCP_TOOLS = {
  widgetData: 'get_widget_data',
  widgetValues: 'get_widget_values',
  savedWidget: 'get_saved_widget',
  queryDataset: 'query_dataset',
  proxy: 'call_tool',
} as const;

/** `null` outside an artifact, or when this view may not use connectors. */
export async function getArtifactMcp(): Promise<ArtifactMcp | null> {
  const { claude } = globalThis as {
    claude?: { use?: (name: string) => Promise<unknown> };
  };
  if (!claude || typeof claude.use !== 'function') return null;
  try {
    const mcp = (await claude.use('mcp')) as ArtifactMcp | null;
    return mcp && typeof mcp.callTool === 'function' ? mcp : null;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DATA_KEYS = [
  'columns',
  'rows',
  'data',
  'values',
  'uuid',
  'error',
  'error_type',
];

function parseText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * The tool's JSON payload out of a `callTool` resolution: `payload` when the
 * runtime provides it, otherwise `structuredContent` or the first text block.
 * A proxied call nests the real tool's result one level deeper, and FastMCP
 * wraps non-object results as `{result: ...}`; both are peeled here.
 */
export function extractPayload(value: unknown, depth = 0): unknown {
  if (depth > 4 || !isRecord(value)) return value;
  if ('payload' in value && value.payload !== undefined) {
    return extractPayload(value.payload, depth + 1);
  }
  if ('structuredContent' in value && value.structuredContent !== undefined) {
    return extractPayload(value.structuredContent, depth + 1);
  }
  if (Array.isArray(value.content)) {
    const text = value.content.find(
      (block): block is { type: string; text: string } =>
        isRecord(block) && typeof block.text === 'string',
    );
    return text ? extractPayload(parseText(text.text), depth + 1) : undefined;
  }
  // Tools with a union return type have their structured output wrapped as
  // {result: payload}; data and error payloads never carry a `result` key.
  if ('result' in value && !DATA_KEYS.some(key => key in value)) {
    return extractPayload(value.result, depth + 1);
  }
  return value;
}

const QUERY_DATASET_OPS = new Set([
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'LIKE',
  'NOT LIKE',
  'ILIKE',
  'NOT ILIKE',
  'IN',
  'NOT IN',
  'IS NULL',
  'IS NOT NULL',
  'IS TRUE',
  'IS FALSE',
  'TEMPORAL_RANGE',
]);

interface DatasetFilter {
  col: string;
  op: string;
  val?: unknown;
}

function resolvedToDatasetFilters(filter: ResolvedFilter): DatasetFilter[] {
  const { column: col, operator, value } = filter;
  switch (operator) {
    case 'EQUALS':
      return [{ col, op: '==', val: value }];
    case 'NOT_EQUALS':
      return [{ col, op: '!=', val: value }];
    case 'IN':
      return [{ col, op: 'IN', val: value }];
    case 'NOT_IN':
      return [{ col, op: 'NOT IN', val: value }];
    case 'RANGE': {
      const { min, max } = (value ?? {}) as { min?: unknown; max?: unknown };
      return [
        ...(min != null ? [{ col, op: '>=', val: min }] : []),
        ...(max != null ? [{ col, op: '<=', val: max }] : []),
      ];
    }
    case 'TIME_RANGE': {
      const { start, end } = (value ?? {}) as {
        start?: unknown;
        end?: unknown;
      };
      return [
        ...(start != null ? [{ col, op: '>=', val: start }] : []),
        ...(end != null ? [{ col, op: '<', val: end }] : []),
      ];
    }
    default:
      return [];
  }
}

export function createMcpWidgetClient({
  mcp,
  server,
  strategy = 'widget-tools',
  proxy = false,
  retryDelayMs,
}: McpWidgetClientOptions): WidgetDataClient {
  const mcpReady = Promise.resolve(mcp);

  async function invoke(tool: string, args: unknown): Promise<unknown> {
    const runtime = await mcpReady;
    if (!runtime) throw widgetMcpError('capability_unavailable', server);
    const [name, input] = proxy
      ? [MCP_TOOLS.proxy, { name: tool, arguments: args }]
      : [tool, args];

    let result: unknown;
    try {
      result = await runtime.callTool(server, name, input);
    } catch (error) {
      const first = toWidgetMcpError(error, server);
      // Reads only, and only what the runtime marked retryable: once.
      if (!first.retryable) throw first;
      const wait =
        retryDelayMs ?? first.retryAfterMs ?? 400 + Math.random() * 400;
      await new Promise(resolve => setTimeout(resolve, wait));
      try {
        result = await runtime.callTool(server, name, input);
      } catch (retryError) {
        throw toWidgetMcpError(retryError, server);
      }
    }

    const payload = extractPayload(result);
    const toolError = toolErrorFromPayload(payload, server);
    if (toolError) throw toolError;
    if (payload === undefined) {
      throw widgetMcpError('invalid_response', server);
    }
    return payload;
  }

  const selectorOf = (widget: WidgetRef) =>
    'id' in widget
      ? { id: widget.id }
      : { widget: { type: widget.type, props: widget.props } };

  const toResult = (payload: unknown): QueryDataResult => {
    if (!isRecord(payload)) throw widgetMcpError('invalid_response', server);
    const columns = Array.isArray(payload.columns)
      ? payload.columns.map(column =>
          isRecord(column)
            ? String(column.name ?? column.column_name ?? '')
            : String(column),
        )
      : [];
    const rawRows = payload.rows ?? payload.data;
    const rows = Array.isArray(rawRows) ? (rawRows as DataRow[]) : [];
    return { columns, rows };
  };

  const widgetTools: WidgetDataClient = {
    async fetchData({ widget, filters }) {
      const payload = await invoke(MCP_TOOLS.widgetData, {
        request: {
          ...selectorOf(widget),
          filters: filters.map(({ column, operator, value }) => ({
            column,
            operator,
            value,
          })),
        },
      });
      return toResult(payload);
    },
    async fetchValues({ widget }) {
      const payload = await invoke(MCP_TOOLS.widgetValues, {
        request: selectorOf(widget),
      });
      if (Array.isArray(payload)) return payload;
      if (isRecord(payload) && Array.isArray(payload.values)) {
        return payload.values;
      }
      throw widgetMcpError('invalid_response', server);
    },
    async getSavedWidget(id) {
      const payload = await invoke(MCP_TOOLS.savedWidget, { request: { id } });
      const widget =
        isRecord(payload) && isRecord(payload.widget)
          ? payload.widget
          : payload;
      if (!isRecord(widget) || typeof widget.widget_type !== 'string') {
        throw widgetMcpError('invalid_response', server);
      }
      return widget as unknown as SavedWidget;
    },
  };

  const unsupported = (detail: string) =>
    widgetMcpError('unsupported', server, detail);

  const authoredFilters = (binding: DataBindingSpec): DatasetFilter[] =>
    (binding.filters ?? []).map(filter => {
      const { expressionType, subject, operator, comparator } = filter as {
        expressionType?: unknown;
        subject?: unknown;
        operator?: unknown;
        comparator?: unknown;
      };
      if (
        expressionType !== 'SIMPLE' ||
        typeof subject !== 'string' ||
        typeof operator !== 'string' ||
        !QUERY_DATASET_OPS.has(operator)
      ) {
        throw unsupported(
          'This widget has a SQL or unsupported filter, which needs the "widget-tools" strategy.',
        );
      }
      return { col: subject, op: operator, val: comparator };
    });

  const queryDataset: WidgetDataClient = {
    async fetchData({ widget, filters }) {
      if ('id' in widget) {
        throw unsupported('Saved widgets need the "widget-tools" strategy.');
      }
      const binding = widget.props.dataBinding as DataBindingSpec | undefined;
      if (!binding) throw unsupported('This widget has no dataBinding.');
      const metrics = binding.metrics ?? [];
      if (!metrics.every(metric => typeof metric === 'string')) {
        throw unsupported(
          'Ad hoc metrics need the "widget-tools" strategy; use saved metric names.',
        );
      }
      const payload = await invoke(MCP_TOOLS.queryDataset, {
        request: {
          dataset_id: binding.datasetId,
          metrics,
          columns: (binding.dimensions ?? []).filter(Boolean),
          filters: [
            ...authoredFilters(binding),
            ...filters.flatMap(resolvedToDatasetFilters),
          ],
          row_limit: binding.rowLimit ?? 1000,
        },
      });
      return toResult(payload);
    },
    async fetchValues({ widget }) {
      if ('id' in widget) {
        throw unsupported('Saved widgets need the "widget-tools" strategy.');
      }
      const { datasetId, column } = widget.props as {
        datasetId?: number;
        column?: string;
      };
      if (datasetId == null || !column) return [];
      const payload = await invoke(MCP_TOOLS.queryDataset, {
        request: { dataset_id: datasetId, columns: [column], row_limit: 1000 },
      });
      const { rows } = toResult(payload);
      return [...new Set(rows.map(row => row[column]))];
    },
    getSavedWidget() {
      return Promise.reject(
        unsupported('Saved widgets need the "widget-tools" strategy.'),
      );
    },
  };

  return strategy === 'query-dataset' ? queryDataset : widgetTools;
}

export { WidgetMcpError };
