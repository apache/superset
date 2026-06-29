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
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  Column,
  DatasourceType,
  ensureIsArray,
  useChangeEffect,
  selectClientErrorMessage,
} from '@superset-ui/core';
import { type FormInstance, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  useDatasetMetadata,
  useSemanticViewStructure,
  getClientErrorFromUnknown,
} from 'src/dashboard/queries';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import { semanticViewDimensionsToColumns } from './utils';

const COLUMN_SELECT_PROJECTION = [
  'columns.column_name',
  'columns.is_dttm',
  'columns.type_generic',
  'columns.filterable',
];

const VERBOSE_COLUMN_SELECT_PROJECTION = [
  ...COLUMN_SELECT_PROJECTION,
  'columns.verbose_name',
];

interface ColumnSelectProps {
  allowClear?: boolean;
  filterValues?: (column: Column) => boolean;
  form: FormInstance<NativeFiltersForm>;
  formField?: keyof NativeFiltersFormItem;
  filterId: string;
  datasetId?: number;
  datasourceType?: DatasourceType;
  value?: string | string[];
  onChange?: (value: string) => void;
  mode?: 'multiple';
  // Called with the names of the columns that back the rendered options
  // (already narrowed by `filterValues`) whenever a dataset's columns load,
  // plus the datasource key (see getDatasourceKey) they were loaded for. Lets
  // a parent seed a default selection that matches the options exactly, and
  // tell which datasource a selection belongs to.
  onColumnsLoaded?: (columnNames: string[], datasourceKey: string) => void;
  // Label options (and selected values) with the column's verbose name,
  // falling back to column_name. Search matches either.
  showVerboseNames?: boolean;
  placeholder?: string;
}

/**
 * Identifies a datasource across both ID sequences. Datasets and semantic
 * views have independent IDs, so the type is part of the key.
 */
export const getDatasourceKey = (
  datasetId: number | string | undefined,
  datasourceType: DatasourceType | undefined,
) => `${datasetId}__${datasourceType || DatasourceType.Table}`;

/** Special purpose AsyncSelect that selects a column from a dataset */
export function ColumnSelect({
  allowClear = false,
  filterValues = () => true,
  form,
  formField = 'column',
  filterId,
  datasetId,
  datasourceType,
  value,
  onChange,
  mode,
  onColumnsLoaded,
  showVerboseNames = false,
  placeholder = t('Select a column'),
}: ColumnSelectProps) {
  const { addDangerToast } = useToasts();
  const resetColumnField = useCallback(() => {
    form.setFields([
      { name: ['filters', filterId, formField], touched: false, value: null },
    ]);
  }, [form, filterId, formField]);

  // Datasets and semantic views expose columns through different endpoints;
  // source from whichever matches the selected datasource type.
  const isSemanticView = datasourceType === DatasourceType.SemanticView;
  const {
    data: dataset,
    isFetching: datasetLoading,
    error: datasetError,
  } = useDatasetMetadata(
    datasetId,
    showVerboseNames
      ? VERBOSE_COLUMN_SELECT_PROJECTION
      : COLUMN_SELECT_PROJECTION,
    { enabled: !isSemanticView },
  );
  const {
    data: semanticStructure,
    isFetching: semanticLoading,
    error: semanticError,
  } = useSemanticViewStructure(datasetId, { enabled: isSemanticView });

  const loading = isSemanticView ? semanticLoading : datasetLoading;
  const error = isSemanticView ? semanticError : datasetError;
  const columns = useMemo<Column[] | undefined>(() => {
    if (isSemanticView) {
      return semanticStructure
        ? semanticViewDimensionsToColumns(semanticStructure.dimensions)
        : undefined;
    }
    return dataset?.columns as Column[] | undefined;
  }, [isSemanticView, semanticStructure, dataset]);

  const options = useMemo(
    () =>
      ensureIsArray(columns)
        .filter(filterValues)
        .map((col: Column) => ({
          label: (showVerboseNames && col.verbose_name) || col.column_name,
          value: col.column_name,
        })),
    [columns, filterValues, showVerboseNames],
  );

  const currentFilterType =
    form.getFieldValue('filters')?.[filterId].filterType;
  const currentColumn = useMemo(
    () => columns?.find(column => column.column_name === value),
    [columns, value],
  );

  useEffect(() => {
    if (currentColumn && !filterValues(currentColumn)) {
      resetColumnField();
    }
  }, [currentColumn, currentFilterType, resetColumnField, filterValues]);

  // Use a compound key so the effects re-fire when either the dataset ID or
  // the datasource type changes.  Datasets and semantic views have independent
  // ID sequences, so switching between them with the same numeric ID must still
  // trigger a reset. The query hooks key on the same inputs, so `columns` only
  // ever holds the response for the current datasource.
  const datasourceKey = getDatasourceKey(datasetId, datasourceType);
  useChangeEffect(datasourceKey, previous => {
    if (previous != null) {
      resetColumnField();
    }
  });

  // When the loaded columns don't contain the current value, clear it. An
  // empty selection has nothing to look up and is legitimate (e.g. a cleared
  // multi-select), so it must not trigger a reset of the form field.
  useEffect(() => {
    if (!columns) {
      return;
    }
    const lookupValue = ensureIsArray(value);
    const valueExists =
      lookupValue.length === 0 ||
      columns.some((column: Column) =>
        lookupValue.includes(column.column_name),
      );
    if (!valueExists) {
      resetColumnField();
    }
  }, [columns, value, resetColumnField]);

  // Report loaded columns once per datasource load, narrowed the same way the
  // option list is. Read the callbacks through refs so a parent passing fresh
  // closures each render does not re-trigger the report.
  const onColumnsLoadedRef = useRef(onColumnsLoaded);
  onColumnsLoadedRef.current = onColumnsLoaded;
  const filterValuesRef = useRef(filterValues);
  filterValuesRef.current = filterValues;
  useEffect(() => {
    if (!columns) {
      return;
    }
    onColumnsLoadedRef.current?.(
      ensureIsArray(columns)
        .filter(filterValuesRef.current)
        .map((col: Column) => col.column_name),
      datasourceKey,
    );
  }, [columns, datasourceKey]);

  // Surface dataset fetch errors as a toast.
  useEffect(() => {
    if (!error) {
      return;
    }
    getClientErrorFromUnknown(error).then(clientError => {
      addDangerToast(
        selectClientErrorMessage(clientError, t('An error has occurred'), {
          403: t('You do not have permission to edit this dashboard'),
        }),
      );
    });
  }, [error, addDangerToast]);

  return (
    <Select
      mode={mode}
      value={mode === 'multiple' ? value || [] : value}
      ariaLabel={t('Column select')}
      loading={loading}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      notFoundContent={t('No compatible columns found')}
      showSearch
      allowClear={allowClear}
    />
  );
}
