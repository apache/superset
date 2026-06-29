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
import { useCallback, useMemo, useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
  Column,
  DatasourceType,
  ensureIsArray,
  useChangeEffect,
} from '@superset-ui/core';
import { type FormInstance, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  useDatasetMetadata,
  useSemanticViewStructure,
  getClientErrorFromUnknown,
} from 'src/dashboard/queries';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import { mapSemanticTypeToGenericDataType } from './utils';

const COLUMN_SELECT_PROJECTION = [
  'columns.column_name',
  'columns.is_dttm',
  'columns.type_generic',
  'columns.filterable',
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
}

/** Special purpose AsyncSelect that selects a column from a dataset */
// eslint-disable-next-line import/prefer-default-export
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
  } = useDatasetMetadata(datasetId, COLUMN_SELECT_PROJECTION, {
    enabled: !isSemanticView,
  });
  const {
    data: semanticStructure,
    isFetching: semanticLoading,
    error: semanticError,
  } = useSemanticViewStructure(datasetId, { enabled: isSemanticView });

  const loading = isSemanticView ? semanticLoading : datasetLoading;
  const error = isSemanticView ? semanticError : datasetError;
  const columns = useMemo<Column[] | undefined>(() => {
    if (isSemanticView) {
      return semanticStructure?.dimensions.map(dim => {
        const mappedType = mapSemanticTypeToGenericDataType(dim.type);
        return {
          column_name: dim.name,
          type: dim.type,
          is_dttm: mappedType === GenericDataType.Temporal,
          type_generic: mappedType,
          filterable: true,
        } as Column;
      });
    }
    return dataset?.columns as Column[] | undefined;
  }, [isSemanticView, semanticStructure, dataset]);

  const options = useMemo(
    () =>
      ensureIsArray(columns)
        .filter(filterValues)
        .map((col: Column) => col.column_name)
        .map((column: string) => ({ label: column, value: column })),
    [columns, filterValues],
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

  // Use a compound key so the effect re-fires when either the dataset ID or
  // the datasource type changes.  Datasets and semantic views have independent
  // ID sequences, so switching between them with the same numeric ID must still
  // trigger a reset.
  const datasourceKey = `${datasetId}__${datasourceType || DatasourceType.Table}`;
  useChangeEffect(datasourceKey, previous => {
    if (previous != null) {
      resetColumnField();
    }
  });

  // When the loaded columns don't contain the current value, clear it.
  useEffect(() => {
    if (!columns) {
      return;
    }
    const lookupValue = Array.isArray(value) ? value : [value];
    const valueExists = columns.some((column: Column) =>
      lookupValue?.includes(column.column_name),
    );
    if (!valueExists) {
      resetColumnField();
    }
  }, [columns, value, resetColumnField]);

  // Surface dataset fetch errors as a toast.
  useEffect(() => {
    if (!error) {
      return;
    }
    getClientErrorFromUnknown(error).then(({ error: errorDetail, message }) => {
      let errorText = message || errorDetail || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      addDangerToast(errorText);
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
      placeholder={t('Select a column')}
      notFoundContent={t('No compatible columns found')}
      showSearch
      allowClear={allowClear}
    />
  );
}
