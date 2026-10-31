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
import { GenericDataType } from '@apache-superset/core/common';
import {
  DataRecordValue,
  getColumnLabel,
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { NULL_STRING } from '../constants';
import { formatSeriesName } from '../utils/series';

/**
 * Display text for an empty string. Matches `optionLabel` in
 * `src/utils/common.ts`; this plugin cannot import that module.
 */
export const EMPTY_STRING = '<empty string>';

export type SankeyFilterColumn = 'source' | 'target';

/** Fields ECharts keeps on a node and returns from a click. */
export type SankeyNodeDatum = {
  /** Typed value id. Link endpoints use the same id, not the display label. */
  name: string;
  displayName: string;
  filterColumn: SankeyFilterColumn;
  rawValue: DataRecordValue;
};

/** Fields ECharts keeps on a link and returns from a click. */
export type SankeyLinkDatum = {
  source: string;
  target: string;
  value: number;
  sourceValue: DataRecordValue;
  targetValue: DataRecordValue;
};

type NamedLink = {
  source: string;
  target: string;
};

type ParsedSelection =
  | { kind: 'node'; column: SankeyFilterColumn; id: string }
  | { kind: 'link'; source: string; target: string };

export type SankeyHighlight = {
  nodeIds: ReadonlySet<string>;
  linkKeys: ReadonlySet<string>;
};

/**
 * Label shown on the chart and the filter chip. `null` and `''` stay readable
 * and distinct. This text is not the graph id: several values share one label.
 */
export function sankeyNodeName(value: DataRecordValue): string {
  if (value == null) {
    return NULL_STRING;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  const text = String(value);
  return text === '' ? EMPTY_STRING : text;
}

/**
 * Identity of one source or target value. JSON keeps `null`, `''`, `42`,
 * `"42"`, and `42n` apart, so they stay separate nodes and separate clicks.
 */
export function sankeyValueId(value: DataRecordValue): string {
  if (value == null) {
    return JSON.stringify(null);
  }
  if (typeof value === 'bigint') {
    return JSON.stringify({ bigint: value.toString() });
  }
  if (value instanceof Date) {
    return JSON.stringify({ date: value.toISOString() });
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}

export function sankeyNodeKey(
  column: SankeyFilterColumn,
  value: DataRecordValue,
): string {
  return JSON.stringify(['node', column, sankeyValueId(value)]);
}

export function sankeyLinkKey(
  source: DataRecordValue,
  target: DataRecordValue,
): string {
  return JSON.stringify(['link', sankeyValueId(source), sankeyValueId(target)]);
}

export function isSankeyLinkDatum(data: unknown): data is SankeyLinkDatum {
  return (
    typeof data === 'object' &&
    data !== null &&
    'sourceValue' in data &&
    'targetValue' in data
  );
}

export function isSankeyNodeDatum(data: unknown): data is SankeyNodeDatum {
  return (
    typeof data === 'object' &&
    data !== null &&
    'filterColumn' in data &&
    'rawValue' in data &&
    !isSankeyLinkDatum(data)
  );
}

export function getSelectedSankeyKeys(selectedValues: unknown): string[] {
  if (!selectedValues) {
    return [];
  }
  if (Array.isArray(selectedValues)) {
    return selectedValues.map(value => String(value));
  }
  if (typeof selectedValues === 'object') {
    return Object.values(selectedValues as Record<string, unknown>).map(value =>
      String(value),
    );
  }
  return [];
}

function parseSelection(key: string): ParsedSelection | undefined {
  try {
    const parsed: unknown = JSON.parse(key);
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    if (
      parsed[0] === 'node' &&
      (parsed[1] === 'source' || parsed[1] === 'target') &&
      typeof parsed[2] === 'string'
    ) {
      return { kind: 'node', column: parsed[1], id: parsed[2] };
    }
    if (
      parsed[0] === 'link' &&
      typeof parsed[1] === 'string' &&
      typeof parsed[2] === 'string'
    ) {
      return { kind: 'link', source: parsed[1], target: parsed[2] };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function endpointKey(source: string, target: string): string {
  return JSON.stringify([source, target]);
}

function linksByEndpoint(links: NamedLink[]): {
  bySource: Map<string, NamedLink[]>;
  byTarget: Map<string, NamedLink[]>;
} {
  const bySource = new Map<string, NamedLink[]>();
  const byTarget = new Map<string, NamedLink[]>();
  links.forEach(link => {
    const sources = bySource.get(link.source);
    if (sources) {
      sources.push(link);
    } else {
      bySource.set(link.source, [link]);
    }
    const targets = byTarget.get(link.target);
    if (targets) {
      targets.push(link);
    } else {
      byTarget.set(link.target, [link]);
    }
  });
  return { bySource, byTarget };
}

/**
 * Nodes and links that stay bright for the current selection. Endpoints are
 * indexed once so a click does not scan every link for every node.
 */
export function getSankeyHighlight(
  selectedKeys: string[],
  links: NamedLink[],
): SankeyHighlight | undefined {
  if (selectedKeys.length === 0) {
    return undefined;
  }
  const { bySource, byTarget } = linksByEndpoint(links);
  const nodeIds = new Set<string>();
  const linkKeys = new Set<string>();
  selectedKeys.forEach(key => {
    const selection = parseSelection(key);
    if (!selection) {
      return;
    }
    if (selection.kind === 'link') {
      linkKeys.add(endpointKey(selection.source, selection.target));
      nodeIds.add(selection.source);
      nodeIds.add(selection.target);
      return;
    }
    nodeIds.add(selection.id);
    const matched =
      selection.column === 'source'
        ? bySource.get(selection.id)
        : byTarget.get(selection.id);
    matched?.forEach(link => {
      linkKeys.add(endpointKey(link.source, link.target));
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });
  });
  return { nodeIds, linkKeys };
}

export function sankeyEndpointKey(source: string, target: string): string {
  return endpointKey(source, target);
}

/**
 * `bigint` throws in `JSON.stringify`, and the data mask is serialized into
 * dashboard state and the chart-data request.
 */
export function toJsonSafeFilterValue(
  value: Exclude<DataRecordValue, null>,
): Exclude<DataRecordValue, null | bigint> {
  return typeof value === 'bigint' ? value.toString() : value;
}

function dimensionFilter(
  col: QueryFormColumn,
  value: DataRecordValue,
): QueryObjectFilterClause {
  if (value == null) {
    return { col, op: 'IS NULL' };
  }
  return {
    col,
    op: 'IN',
    val: [toJsonSafeFilterValue(value)],
  };
}

/**
 * Chip text for one column. An empty string is labeled before
 * `formatSeriesName`, which would leave it blank. Numbers stay unformatted:
 * the smart number formatter would abbreviate an id or a year.
 */
function formatPart(
  col: QueryFormColumn,
  value: DataRecordValue,
  coltypeMapping?: Record<string, GenericDataType>,
): string {
  if (value === '') {
    return EMPTY_STRING;
  }
  return formatSeriesName(value, {
    timeFormatter: getTimeFormatter(),
    coltype: coltypeMapping?.[getColumnLabel(col)],
  });
}

function selectionKey(datum: SankeyNodeDatum | SankeyLinkDatum): string {
  return isSankeyLinkDatum(datum)
    ? sankeyLinkKey(datum.sourceValue, datum.targetValue)
    : sankeyNodeKey(datum.filterColumn, datum.rawValue);
}

function selectionFilters(
  source: QueryFormColumn,
  target: QueryFormColumn,
  datum: SankeyNodeDatum | SankeyLinkDatum,
): QueryObjectFilterClause[] {
  if (isSankeyLinkDatum(datum)) {
    return [
      dimensionFilter(source, datum.sourceValue),
      dimensionFilter(target, datum.targetValue),
    ];
  }
  const column = datum.filterColumn === 'source' ? source : target;
  return [dimensionFilter(column, datum.rawValue)];
}

function selectionLabel(
  source: QueryFormColumn,
  target: QueryFormColumn,
  datum: SankeyNodeDatum | SankeyLinkDatum,
  coltypeMapping?: Record<string, GenericDataType>,
): string {
  if (isSankeyLinkDatum(datum)) {
    const sourceLabel = formatPart(source, datum.sourceValue, coltypeMapping);
    const targetLabel = formatPart(target, datum.targetValue, coltypeMapping);
    return `${sourceLabel} → ${targetLabel}`;
  }
  const column = datum.filterColumn === 'source' ? source : target;
  return formatPart(column, datum.rawValue, coltypeMapping);
}

export function getSankeyCrossFilterDataMask({
  source,
  target,
  datum,
  selectedKeys,
  coltypeMapping,
}: {
  source: QueryFormColumn;
  target: QueryFormColumn;
  datum: SankeyNodeDatum | SankeyLinkDatum;
  selectedKeys: string[];
  coltypeMapping?: Record<string, GenericDataType>;
}) {
  const key = selectionKey(datum);
  const isCurrentValueSelected = selectedKeys.includes(key);
  const nextKeys = isCurrentValueSelected ? [] : [key];
  const label = selectionLabel(source, target, datum, coltypeMapping);
  const filters =
    nextKeys.length === 0 ? [] : selectionFilters(source, target, datum);

  return {
    dataMask: {
      extraFormData: {
        filters,
      },
      filterState: {
        label: nextKeys.length ? label : null,
        value: nextKeys.length ? label : null,
        selectedValues: nextKeys.length ? nextKeys : null,
      },
    },
    isCurrentValueSelected,
  };
}

export function getSankeyDrillFilters(
  source: QueryFormColumn,
  target: QueryFormColumn,
  datum: SankeyNodeDatum | SankeyLinkDatum,
  coltypeMapping?: Record<string, GenericDataType>,
): QueryObjectFilterClause[] {
  const columns: Array<{ col: QueryFormColumn; value: DataRecordValue }> =
    isSankeyLinkDatum(datum)
      ? [
          { col: source, value: datum.sourceValue },
          { col: target, value: datum.targetValue },
        ]
      : [
          {
            col: datum.filterColumn === 'source' ? source : target,
            value: datum.rawValue,
          },
        ];
  return columns.map(({ col, value }) => {
    const formattedVal = formatPart(col, value, coltypeMapping);
    if (value == null) {
      return { col, op: 'IS NULL' as const, formattedVal };
    }
    return {
      col,
      op: '==' as const,
      val: toJsonSafeFilterValue(value),
      formattedVal,
    };
  });
}
