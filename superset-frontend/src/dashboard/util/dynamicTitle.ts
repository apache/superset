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
import type { DataMask, Filter } from '@superset-ui/core';
import { DatasourceType, NO_TIME_RANGE } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { snakeCase } from 'lodash-es';
import type { DynamicTitleConfig } from 'src/dashboard/types';
import { extractLabel } from '../components/nativeFilters/selectors';
import { getFilterValueForDisplay } from '../components/nativeFilters/utils';

export const CHART_TITLE_ALIAS = 'chart_title';
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface DynamicTitleFilter {
  id: string;
  name: string;
  value?: string;
}

/** Only infer temporal incompatibility when physical dataset metadata proves it. */
export function hasNoTemporalTitleSupport(
  datasource?: {
    type?: DatasourceType;
    sql?: string | null;
    column_types?: GenericDataType[];
    columns?: { is_dttm?: boolean; expression?: string | null }[];
    metrics?: { expression?: string | null }[];
  },
  formData?: unknown,
): boolean {
  return Boolean(
    datasource?.type === DatasourceType.Table &&
    (datasource.sql === '' || datasource.sql === null) &&
    // Dashboard columns are projected; column_types describes the full dataset.
    datasource.column_types?.length &&
    !datasource.column_types.includes(GenericDataType.Temporal) &&
    Array.isArray(datasource.columns) &&
    datasource.columns.every(column => column.is_dttm === false) &&
    // Virtual SQL and calculated expressions can consume time through Jinja.
    !/\{\{|\{%/.test(
      JSON.stringify([datasource.columns, datasource.metrics, formData]),
    ),
  );
}

/** Match the existing dashboard title override fallback. */
export function getChartBaseTitle(
  override?: string,
  originalTitle?: string,
): string {
  return override || originalTitle || '';
}

/** Return unique aliases without sharing mutable regexp iteration state. */
export function extractDynamicTitleAliases(template: string): string[] {
  return Array.from(
    new Set(
      Array.from(template.matchAll(PLACEHOLDER_REGEX), match => match[1]),
    ),
  );
}

export function hasInvalidDynamicTitleTokens(template: string): boolean {
  return /\{\{|\}\}/.test(template.replace(PLACEHOLDER_REGEX, ''));
}

export function createDynamicTitleAlias(
  name: string,
  existingAliases: Iterable<string>,
): string {
  const usedAliases = new Set([CHART_TITLE_ALIAS, ...existingAliases]);
  const base = snakeCase(name).replace(/[^a-zA-Z0-9_]/g, '') || 'filter';
  let alias = base;
  let suffix = 2;
  while (usedAliases.has(alias)) {
    alias = `${base}_${suffix}`;
    suffix += 1;
  }
  return alias;
}

/** Use filter labels, preserving zero and false while ignoring cleared values. */
export function getDynamicTitleFilterValue(
  filter: Pick<Filter, 'filterType'>,
  dataMask?: DataMask,
): string | undefined {
  const state = dataMask?.filterState;
  const value: unknown = state?.value;
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (filter.filterType === 'filter_time' && value === NO_TIME_RANGE) ||
    (filter.filterType === 'filter_range' &&
      Array.isArray(value) &&
      value.every(bound => bound === null || bound === undefined))
  ) {
    return undefined;
  }

  const label = extractLabel(state);
  const formatted =
    label?.trim() ||
    (typeof value === 'boolean'
      ? String(value)
      : getFilterValueForDisplay(
          value as Parameters<typeof getFilterValueForDisplay>[0],
        ));
  return formatted?.trim() || undefined;
}

/** Validate references against current scope, independently of filter values. */
export function getInvalidDynamicTitleAliases(
  config: DynamicTitleConfig,
  filters: readonly DynamicTitleFilter[],
): string[] {
  const filterIds = new Set(filters.map(filter => filter.id));
  return extractDynamicTitleAliases(config.template).filter(
    alias =>
      alias !== CHART_TITLE_ALIAS &&
      (typeof config.tokenMappings?.[alias] !== 'string' ||
        !filterIds.has(config.tokenMappings[alias])),
  );
}

/** A missing used token falls back to the complete base title. */
export function resolveDynamicTitle(
  config: DynamicTitleConfig | undefined,
  baseTitle: string,
  filters: readonly DynamicTitleFilter[],
): string {
  if (
    typeof config?.template !== 'string' ||
    !config.template.trim() ||
    hasInvalidDynamicTitleTokens(config.template)
  ) {
    return baseTitle;
  }

  const filtersById = new Map(filters.map(filter => [filter.id, filter]));
  const values = new Map<string, string>([[CHART_TITLE_ALIAS, baseTitle]]);
  for (const alias of extractDynamicTitleAliases(config.template)) {
    if (alias === CHART_TITLE_ALIAS) {
      continue;
    }
    const filterId = config.tokenMappings?.[alias];
    const value =
      typeof filterId === 'string'
        ? filtersById.get(filterId)?.value
        : undefined;
    if (!value) {
      return baseTitle;
    }
    values.set(alias, value);
  }
  return (
    config.template
      .replace(PLACEHOLDER_REGEX, (_, alias: string) => values.get(alias) ?? '')
      .replace(/\s+/g, ' ')
      .trim() || baseTitle
  );
}
