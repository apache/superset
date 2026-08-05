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
import type {
  chat as chatApi,
  dashboard as dashboardApi,
} from '@apache-superset/core';
import { dashboard } from 'src/core/dashboard';

type ClientTool = chatApi.ClientTool;
type ClientToolResult = chatApi.ClientToolResult;
type DashboardNode = dashboardApi.DashboardNode;
type BuildingBlockSpec = dashboardApi.BuildingBlockSpec;
type LayoutProps = dashboardApi.LayoutProps;
type DataBindingSpec = dashboardApi.DataBindingSpec;
type QueryDataResult = dashboardApi.QueryDataResult;

const QUERY_BACKED_BLOCKS = new Set([
  'echarts',
  'ag-grid-table',
  'metric-tile',
]);
const PREVIEW_ROWS = 20;

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const layoutSchema = {
  type: 'object',
  description:
    'Grid geometry. col/row are 1-based; omit both to auto-place the block.',
  properties: {
    columns: { type: 'integer', minimum: 1 },
    gap: { type: 'number', minimum: 0 },
    rowUnit: { type: 'number', exclusiveMinimum: 0 },
    colSpan: { type: 'integer', minimum: 1 },
    rowSpan: { type: 'integer', minimum: 1 },
    col: { type: 'integer', minimum: 1 },
    row: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
};

const dataBindingSchema = {
  type: 'object',
  properties: {
    datasetId: { type: 'integer', minimum: 1 },
    metrics: {
      type: 'array',
      description: 'Saved metric names or Superset ad-hoc metric objects.',
      items: {},
    },
    dimensions: { type: 'array', items: { type: 'string' } },
    filters: { type: 'array', items: { type: 'object' } },
    rowLimit: { type: 'integer', minimum: 1 },
  },
  required: ['datasetId', 'metrics'],
  additionalProperties: false,
};

function jsonResult(value: unknown): ClientToolResult {
  return { content: JSON.stringify(value, null, 2) };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredRecord(
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return asRecord(args[key], `"${key}"`);
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`"${key}" must be a non-empty string.`);
  }
  return value;
}

function requiredInteger(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`"${key}" must be an integer.`);
  }
  return value;
}

function optionalInteger(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  return args[key] === undefined ? fallback : requiredInteger(args, key);
}

function positiveNumber(
  value: unknown,
  label: string,
  integer: boolean,
  allowZero = false,
): number {
  const lowerBoundValid =
    typeof value === 'number' && (allowZero ? value >= 0 : value > 0);
  if (!lowerBoundValid || (integer && !Number.isInteger(value))) {
    const kind = integer ? 'integer' : 'number';
    throw new Error(
      `${label} must be a ${allowZero ? 'non-negative' : 'positive'} ${kind}.`,
    );
  }
  return value;
}

function optionalLayout(value: unknown): Partial<LayoutProps> | undefined {
  if (value === undefined) return undefined;
  const layout = asRecord(value, '"layout"');
  const result: Partial<LayoutProps> = {};
  if (layout.columns !== undefined) {
    result.columns = positiveNumber(layout.columns, 'layout.columns', true);
  }
  if (layout.gap !== undefined) {
    result.gap = positiveNumber(layout.gap, 'layout.gap', false, true);
  }
  if (layout.rowUnit !== undefined) {
    result.rowUnit = positiveNumber(layout.rowUnit, 'layout.rowUnit', false);
  }
  if (layout.colSpan !== undefined) {
    result.colSpan = positiveNumber(layout.colSpan, 'layout.colSpan', true);
  }
  if (layout.rowSpan !== undefined) {
    result.rowSpan = positiveNumber(layout.rowSpan, 'layout.rowSpan', true);
  }
  if (layout.col !== undefined) {
    result.col = positiveNumber(layout.col, 'layout.col', true);
  }
  if (layout.row !== undefined) {
    result.row = positiveNumber(layout.row, 'layout.row', true);
  }
  return result;
}

function dataBinding(value: unknown): DataBindingSpec {
  const binding = asRecord(value, '"dataBinding"');
  const datasetId = positiveNumber(
    binding.datasetId,
    'dataBinding.datasetId',
    true,
  );
  if (!Array.isArray(binding.metrics)) {
    throw new Error('dataBinding.metrics must be an array.');
  }
  if (
    binding.dimensions !== undefined &&
    (!Array.isArray(binding.dimensions) ||
      !binding.dimensions.every(item => typeof item === 'string'))
  ) {
    throw new Error('dataBinding.dimensions must be an array of strings.');
  }
  if (
    binding.filters !== undefined &&
    (!Array.isArray(binding.filters) ||
      !binding.filters.every(
        item =>
          item !== null && typeof item === 'object' && !Array.isArray(item),
      ))
  ) {
    throw new Error('dataBinding.filters must be an array of objects.');
  }

  const rowLimit =
    binding.rowLimit === undefined
      ? undefined
      : positiveNumber(binding.rowLimit, 'dataBinding.rowLimit', true);

  return {
    datasetId,
    metrics: binding.metrics,
    dimensions: binding.dimensions as string[] | undefined,
    filters: binding.filters as Record<string, unknown>[] | undefined,
    rowLimit,
  };
}

function blockSpec(value: unknown): BuildingBlockSpec {
  const block = asRecord(value, '"block"');
  if (typeof block.type !== 'string' || block.type.trim() === '') {
    throw new Error('block.type must be a non-empty string.');
  }
  return {
    type: block.type,
    layout: optionalLayout(block.layout),
    props:
      block.props === undefined
        ? undefined
        : asRecord(block.props, 'block.props'),
    style:
      block.style === undefined
        ? undefined
        : asRecord(block.style, 'block.style'),
  };
}

async function validateQueryBackedBlock(
  type: string,
  props: Record<string, unknown> | undefined,
  requireBinding: boolean,
): Promise<QueryDataResult | undefined> {
  if (!QUERY_BACKED_BLOCKS.has(type)) return undefined;
  if (!props || props.dataBinding === undefined) {
    if (requireBinding) {
      throw new Error(`${type} blocks require props.dataBinding.`);
    }
    return undefined;
  }
  return dashboard.fetchQueryData(dataBinding(props.dataBinding));
}

function queryPreview(result: QueryDataResult | undefined) {
  return result
    ? { columns: result.columns, rows: result.rows.slice(0, PREVIEW_ROWS) }
    : undefined;
}

function readDashboardState() {
  const root = dashboard.getRoot();
  const nodes: Record<string, DashboardNode> = {};

  const visit = (node: DashboardNode) => {
    nodes[node.id] = node;
    node.children?.forEach(id => {
      const child = dashboard.getNode(id);
      if (child) visit(child);
    });
  };
  visit(root);

  return { rootId: root.id, nodes };
}

/**
 * Tools offered only while Dashboard v2 is mounted. Their handlers use the
 * same public dashboard API that extensions use, so model edits and direct UI
 * edits share one store, renderer, collision policy, and revision stream.
 */
export const dashboardClientTools: ClientTool[] = [
  {
    name: 'dashboard_get_state',
    description:
      'Read the complete unsaved Dashboard v2 tree visible on screen. Call this before editing so you use real node and parent ids. Returns {rootId,nodes}, where nodes is keyed by id and each node has type, layout, props, style, and canvas child ids. Built-in types are canvas, markdown, echarts, ag-grid-table, and metric-tile.',
    inputSchema: emptyInputSchema,
    execute: () => jsonResult(readDashboardState()),
  },
  {
    name: 'dashboard_validate_data_binding',
    description:
      'Run a Dashboard v2 data binding against Superset before creating or changing a live chart, table, or metric tile. Use exact dataset, metric, and dimension names obtained from server tools. Returns result column aliases and up to 20 preview rows; use those exact aliases in ECharts $bind markers.',
    inputSchema: {
      type: 'object',
      properties: { dataBinding: dataBindingSchema },
      required: ['dataBinding'],
      additionalProperties: false,
    },
    execute: async args => {
      const result = await dashboard.fetchQueryData(
        dataBinding(args.dataBinding),
      );
      return jsonResult(queryPreview(result));
    },
  },
  {
    name: 'dashboard_add_building_block',
    description:
      'Add a block to the unsaved Dashboard v2 canvas and show it immediately. Read the state first. parent_id must name a canvas; omit index to append. Built-ins: markdown props {content}; metric-tile props {dataBinding,label?,prefix?,suffix?,decimals?}; ag-grid-table props {dataBinding,columnDefs?}; echarts props {dataBinding,echartsOptions}. In echartsOptions bind result data with {"$bind":{"source":"metric"|"dimension","alias":"exact column alias","single":true?}}, record arrays with {"$bind":{"source":"records","fields":{"name":"dimension alias","value":"metric alias"}}}, and theme tokens with {"$bind":{"source":"theme","token":"colorPrimary"}}. A canvas has children and may set layout.columns/gap/rowUnit. Every block layout may set colSpan/rowSpan and optional 1-based col/row. Query-backed blocks are validated before insertion. Returns the created node and a data preview when applicable.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string' },
        index: { type: 'integer', minimum: 0 },
        block: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            layout: layoutSchema,
            props: { type: 'object' },
            style: { type: 'object' },
          },
          required: ['type'],
          additionalProperties: false,
        },
      },
      required: ['parent_id', 'block'],
      additionalProperties: false,
    },
    execute: async args => {
      const parentId = requiredString(args, 'parent_id');
      const parent = dashboard.getNode(parentId);
      if (!parent?.children) {
        throw new Error(`Parent "${parentId}" is not a canvas node.`);
      }
      const index = optionalInteger(args, 'index', parent.children.length);
      if (index < 0) throw new Error('"index" must be non-negative.');
      const spec = blockSpec(args.block);
      const preview = await validateQueryBackedBlock(
        spec.type,
        spec.props,
        true,
      );
      const id = dashboard.addBuildingBlock(parentId, index, spec);
      return jsonResult({
        node: dashboard.getNode(id),
        preview: queryPreview(preview),
      });
    },
  },
  {
    name: 'dashboard_update_layout',
    description:
      'Move or resize one existing Dashboard v2 node within its current parent grid. col/row are 1-based; colSpan/rowSpan control size. Explicit collisions push later blocks downward. Returns the updated node.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        layout: layoutSchema,
      },
      required: ['id', 'layout'],
      additionalProperties: false,
    },
    execute: args => {
      const id = requiredString(args, 'id');
      const layout = optionalLayout(args.layout);
      if (!layout) throw new Error('"layout" is required.');
      dashboard.updateLayout(id, layout);
      return jsonResult({ node: dashboard.getNode(id) });
    },
  },
  {
    name: 'dashboard_update_props',
    description:
      'Merge content properties into an existing Dashboard v2 block and show the change immediately. Read dashboard_get_state first and use its node id; no saved dashboard or chart id is needed. Use this for markdown content, ECharts options/dataBinding, table configuration, or metric-tile labels and formatting. echartsOptions is merged at its top level, so a color-only change can send props {echartsOptions: {color: ["#hex", ...]}} without replacing axes, series, or data bindings. For multiple charts, call this separately for each chart node. A changed dataBinding is validated before the update. Returns the updated node and a data preview when applicable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        props: { type: 'object' },
      },
      required: ['id', 'props'],
      additionalProperties: false,
    },
    execute: async args => {
      const id = requiredString(args, 'id');
      const node = dashboard.getNode(id);
      if (!node) throw new Error(`Unknown dashboard node "${id}".`);
      const props = requiredRecord(args, 'props');
      const nextProps = { ...props };
      if (props.echartsOptions !== undefined) {
        const currentOptions =
          node.props?.echartsOptions === undefined
            ? {}
            : asRecord(node.props.echartsOptions, 'existing echartsOptions');
        nextProps.echartsOptions = {
          ...currentOptions,
          ...asRecord(props.echartsOptions, 'props.echartsOptions'),
        };
      }
      const mergedProps = { ...node.props, ...nextProps };
      const preview =
        props.dataBinding === undefined
          ? undefined
          : await validateQueryBackedBlock(node.type, mergedProps, false);
      dashboard.updateProps(id, nextProps);
      return jsonResult({
        node: dashboard.getNode(id),
        preview: queryPreview(preview),
      });
    },
  },
  {
    name: 'dashboard_move_building_block',
    description:
      'Move an existing Dashboard v2 block (including a canvas subtree) into another canvas. The old explicit grid position is cleared so it auto-places in the destination. Returns the moved node and destination canvas.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        new_parent_id: { type: 'string' },
        new_index: { type: 'integer', minimum: 0 },
      },
      required: ['id', 'new_parent_id', 'new_index'],
      additionalProperties: false,
    },
    execute: args => {
      const id = requiredString(args, 'id');
      const newParentId = requiredString(args, 'new_parent_id');
      const newIndex = requiredInteger(args, 'new_index');
      if (newIndex < 0) throw new Error('"new_index" must be non-negative.');
      dashboard.moveBuildingBlock(id, newParentId, newIndex);
      return jsonResult({
        node: dashboard.getNode(id),
        destination: dashboard.getNode(newParentId),
      });
    },
  },
  {
    name: 'dashboard_remove_building_block',
    description:
      'Remove one Dashboard v2 block from the unsaved canvas. Removing a canvas also removes its entire subtree. Never remove the root. Read the state first and use the exact node id. Returns the removed id and the resulting dashboard state.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    execute: args => {
      const id = requiredString(args, 'id');
      dashboard.removeBuildingBlock(id);
      return jsonResult({ removed: id, dashboard: readDashboardState() });
    },
  },
];
