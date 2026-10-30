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
  name: string;
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
  | { kind: 'node'; column: SankeyFilterColumn; name: string }
  | { kind: 'link'; source: string; target: string };

/**
 * Label used as the ECharts node name. `null` and `''` stay distinct so a
 * click can emit `IS NULL` or `IN ['']`.
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

export function sankeyNodeKey(
  column: SankeyFilterColumn,
  name: string,
): string {
  return JSON.stringify(['node', column, name]);
}

export function sankeyLinkKey(source: string, target: string): string {
  return JSON.stringify(['link', source, target]);
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
      return { kind: 'node', column: parsed[1], name: parsed[2] };
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

function nodeStaysBright(
  name: string,
  selection: ParsedSelection,
  links: NamedLink[],
): boolean {
  if (selection.kind === 'link') {
    return name === selection.source || name === selection.target;
  }
  if (name === selection.name) {
    return true;
  }
  // Keep the other end of each matching flow readable.
  return links.some(link =>
    selection.column === 'source'
      ? link.source === selection.name && link.target === name
      : link.target === selection.name && link.source === name,
  );
}

function linkStaysBright(link: NamedLink, selection: ParsedSelection): boolean {
  if (selection.kind === 'link') {
    return link.source === selection.source && link.target === selection.target;
  }
  return selection.column === 'source'
    ? link.source === selection.name
    : link.target === selection.name;
}

function staysBright(
  selectedKeys: string[],
  matches: (selection: ParsedSelection) => boolean,
): boolean {
  return selectedKeys.some(key => {
    const selection = parseSelection(key);
    return selection ? matches(selection) : false;
  });
}

/** Dim when a selection exists and this node is outside it. */
export function isSankeyNodeDimmed(
  name: string,
  selectedKeys: string[],
  links: NamedLink[],
): boolean {
  if (selectedKeys.length === 0) {
    return false;
  }
  return !staysBright(selectedKeys, selection =>
    nodeStaysBright(name, selection, links),
  );
}

/** Dim when a selection exists and this link is outside it. */
export function isSankeyLinkDimmed(
  link: NamedLink,
  selectedKeys: string[],
): boolean {
  if (selectedKeys.length === 0) {
    return false;
  }
  return !staysBright(selectedKeys, selection =>
    linkStaysBright(link, selection),
  );
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
    ? sankeyLinkKey(datum.source, datum.target)
    : sankeyNodeKey(datum.filterColumn, datum.name);
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
