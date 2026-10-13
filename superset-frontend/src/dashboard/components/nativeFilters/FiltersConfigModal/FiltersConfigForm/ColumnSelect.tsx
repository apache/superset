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
import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import {
  Column,
  DatasourceType,
  ensureIsArray,
  useChangeEffect,
  getClientErrorObject,
  selectClientErrorMessage,
} from '@superset-ui/core';
import { type FormInstance, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import {
  fetchSemanticViewStructure,
  semanticViewDimensionsToColumns,
} from './utils';

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
  const [columns, setColumns] = useState<Column[]>();
  const [loading, setLoading] = useState(false);
  const { addDangerToast } = useToasts();
  const resetColumnField = useCallback(() => {
    form.setFields([
      { name: ['filters', filterId, formField], touched: false, value: null },
    ]);
  }, [form, filterId, formField]);

  // The names backing the rendered options: the loaded columns narrowed by
  // `filterValues`, the same narrowing the option list applies, so a default
  // seeded through onColumnsLoaded matches the available options exactly.
  const filterColumnNames = useCallback(
    (cols: Column[]) =>
      ensureIsArray(cols)
        .filter(filterValues)
        .map((col: Column) => col.column_name),
    [filterValues],
  );

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

  // Whether the current selection still matches a loaded column. An empty
  // selection has nothing to look up and is legitimate (e.g. a cleared
  // multi-select), so it must not trigger a reset of the form field.
  const isValueInColumns = (cols: Column[]) => {
    const lookupValue = ensureIsArray(value);
    return (
      lookupValue.length === 0 ||
      cols.some((column: Column) => lookupValue.includes(column.column_name))
    );
  };

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
  }, [currentColumn, currentFilterType, resetColumnField]);

  // Use a compound key so the effect re-fires when either the dataset ID or
  // the datasource type changes.  Datasets and semantic views have independent
  // ID sequences, so switching between them with the same numeric ID must still
  // trigger a column re-fetch.
  const datasourceKey = getDatasourceKey(datasetId, datasourceType);
  // The datasource whose columns should be shown. A response for any other
  // datasource is stale (the user switched while it was in flight) and is
  // ignored, so it can neither replace the options nor reach onColumnsLoaded.
  const latestDatasourceKey = useRef(datasourceKey);
  latestDatasourceKey.current = datasourceKey;
  useChangeEffect(datasourceKey, previous => {
    const requestKey = datasourceKey;
    const isStale = () => latestDatasourceKey.current !== requestKey;
    if (previous != null) {
      setColumns([]);
      resetColumnField();
    }
    if (datasetId != null) {
      setLoading(true);
      const handleError = async (
        badResponse: Parameters<typeof getClientErrorObject>[0],
      ) => {
        const errorText = selectClientErrorMessage(
          await getClientErrorObject(badResponse),
          t('An error has occurred'),
          { 403: t('You do not have permission to edit this dashboard') },
        );
        addDangerToast(errorText);
      };

      if (datasourceType === DatasourceType.SemanticView) {
        fetchSemanticViewStructure(datasetId)
          .then(({ dimensions }) => {
            if (isStale()) {
              return;
            }
            const cols: Column[] = semanticViewDimensionsToColumns(dimensions);
            if (!isValueInColumns(cols)) {
              resetColumnField();
            }
            setColumns(cols);
            onColumnsLoaded?.(filterColumnNames(cols), requestKey);
          }, handleError)
          .finally(() => {
            if (!isStale()) {
              setLoading(false);
            }
          });
      } else {
        cachedSupersetGet({
          endpoint: `/api/v1/dataset/${datasetId}?q=${rison.encode({
            columns: [
              'columns.column_name',
              'columns.is_dttm',
              'columns.type_generic',
              'columns.filterable',
              ...(showVerboseNames ? ['columns.verbose_name'] : []),
            ],
          })}`,
        })
          .then(({ json: { result } }) => {
            if (isStale()) {
              return;
            }
            if (!isValueInColumns(result.columns)) {
              resetColumnField();
            }
            setColumns(result.columns);
            onColumnsLoaded?.(filterColumnNames(result.columns), requestKey);
          }, handleError)
          .finally(() => {
            if (!isStale()) {
              setLoading(false);
            }
          });
      }
    }
  });

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
