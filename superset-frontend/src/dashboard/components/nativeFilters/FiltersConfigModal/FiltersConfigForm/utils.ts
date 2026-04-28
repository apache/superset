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
import { flatMapDeep } from 'lodash';
import type { FormInstance } from '@superset-ui/core/components';
import { useState, useCallback } from 'react';
import { CustomControlItem, Dataset } from '@superset-ui/chart-controls';
import { Column, ensureIsArray } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { DatasourcesState, ChartsState } from 'src/dashboard/types';
import { FILTER_SUPPORTED_TYPES } from './constants';

const FILTERS_FIELD_NAME = 'filters';

type TimeGrainTuple = [string, string];

export const getTimeGrainOptions = (
  timeGrains: TimeGrainTuple[] = [],
): { value: string; label: string }[] =>
  timeGrains.map(timeGrain => {
    const [value, label] = timeGrain;
    return { value, label: label || value };
  });

export const useForceUpdate = (isActive = true) => {
  const [, updateState] = useState({});
  return useCallback(() => {
    if (isActive) {
      updateState({});
    }
  }, [isActive]);
};

export const setNativeFilterFieldValues = (
  form: FormInstance,
  filterId: string,
  values: object,
) => {
  const formFilters = form.getFieldValue(FILTERS_FIELD_NAME) || {};
  form.setFields([
    {
      name: FILTERS_FIELD_NAME,
      value: {
        ...formFilters,
        [filterId]: {
          ...formFilters[filterId],
          ...values,
        },
      },
    },
  ]);
};

export const getControlItems = (
  controlConfig: { [key: string]: any } = {},
): CustomControlItem[] =>
  (flatMapDeep(controlConfig.controlPanelSections)?.reduce(
    (acc: any, { controlSetRows = [] }: any) => [
      ...acc,
      ...flatMapDeep(controlSetRows),
    ],
    [],
  ) as CustomControlItem[]) ?? [];

// TODO: add column_types field to Dataset
// We return true if column_types is undefined or empty as a precaution against backend failing to return column_types
export const hasTemporalColumns = (
  dataset: Dataset & { column_types: GenericDataType[] },
) => {
  const columnTypes = ensureIsArray(dataset?.column_types);
  return (
    columnTypes.length === 0 || columnTypes.includes(GenericDataType.Temporal)
  );
};

// Determines whether to show the time range picker in pre-filter settings.
// Returns true if dataset is undefined (precautionary default) or has temporal columns.
export const shouldShowTimeRangePicker = (
  currentDataset: (Dataset & { column_types: GenericDataType[] }) | undefined,
): boolean => (currentDataset ? hasTemporalColumns(currentDataset) : true);

export const doesColumnMatchFilterType = (filterType: string, column: Column) =>
  !column.type_generic ||
  !(filterType in FILTER_SUPPORTED_TYPES) ||
  FILTER_SUPPORTED_TYPES[
    filterType as keyof typeof FILTER_SUPPORTED_TYPES
  ]?.includes(column.type_generic);

export const mapSemanticTypeToGenericDataType = (
  semanticType?: string | null,
): GenericDataType | undefined => {
  if (!semanticType) {
    return undefined;
  }

  const normalized = semanticType.toLowerCase();

  if (
    /^(struct|list|map|array|fixed_size_list|large_list|union|dictionary)\b/.test(
      normalized,
    )
  ) {
    return undefined;
  }

  if (normalized.includes('bool')) {
    return GenericDataType.Boolean;
  }

  if (/(date|time|timestamp|datetime)/.test(normalized)) {
    return GenericDataType.Temporal;
  }

  if (
    /(\b(u?int\d*)\b|\bfloat\d*\b|\bdouble\b|\bdecimal\d*\b|\bnumber\b)/.test(
      normalized,
    )
  ) {
    return GenericDataType.Numeric;
  }

  if (
    /(\bstr(ing)?\b|\butf8\b|\blarge_string\b|\bbinary\b|\bjson\b|\buuid\b)/.test(
      normalized,
    )
  ) {
    return GenericDataType.String;
  }

  return undefined;
};

// Validates that a filter default value is present when the default value option is enabled.
// For range filters, at least one of the two values must be non-null.
// For other filters (e.g., filter_select), the value must be non-empty.
// Arrays must have at least one element (empty array means no selection).
export const isValidFilterValue = (
  value: unknown,
  isRangeFilter: boolean,
): boolean => {
  if (isRangeFilter) {
    return Array.isArray(value) && (value[0] !== null || value[1] !== null);
  }
  // For multi-select filters, an empty array means no selection was made
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  // For other values, check if truthy (note: 0 is falsy but unlikely for non-range filters)
  return !!value;
};

export const mostUsedDataset = (
  datasets: DatasourcesState,
  charts: ChartsState,
) => {
  const map = new Map<string, number>();
  let mostUsedDataset = '';
  let maxCount = 0;

  Object.values(charts).forEach(chart => {
    const { form_data: formData } = chart;
    if (formData) {
      const { datasource } = formData;
      const count = (map.get(datasource) || 0) + 1;
      map.set(datasource, count);

      if (count > maxCount) {
        maxCount = count;
        mostUsedDataset = datasource;
      }
    }
  });

  return datasets[mostUsedDataset]?.id;
};

const normalizeDatasourceType = (datasourceType?: string) =>
  datasourceType || 'table';

const parseDatasourceUid = (
  datasourceUid?: string,
): { id?: number; type?: string } => {
  if (!datasourceUid) {
    return {};
  }

  const [rawId, type] = String(datasourceUid).split('__');
  const id = Number(rawId);
  if (Number.isNaN(id)) {
    return {};
  }

  return { id, type };
};

export const doesChartMatchFilterDatasource = (
  chartDatasourceUid: string | undefined,
  loadedDatasets: DatasourcesState,
  filterDatasetId: number,
  filterDatasourceType?: string,
): boolean => {
  const expectedType = normalizeDatasourceType(filterDatasourceType);
  const loadedDataset = chartDatasourceUid
    ? loadedDatasets[chartDatasourceUid]
    : undefined;

  if (loadedDataset) {
    const loadedType = normalizeDatasourceType(
      (loadedDataset as unknown as { datasource_type?: string })
        .datasource_type || loadedDataset.type,
    );

    return loadedDataset.id === filterDatasetId && loadedType === expectedType;
  }

  const parsed = parseDatasourceUid(chartDatasourceUid);
  return (
    parsed.id === filterDatasetId &&
    normalizeDatasourceType(parsed.type) === expectedType
  );
};
