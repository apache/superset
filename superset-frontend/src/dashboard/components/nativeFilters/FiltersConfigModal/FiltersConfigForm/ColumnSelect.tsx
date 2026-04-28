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
import { useCallback, useState, useMemo, useEffect } from 'react';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
  Column,
  ensureIsArray,
  JsonResponse,
  useChangeEffect,
  getClientErrorObject,
} from '@superset-ui/core';
import { type FormInstance, Select } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import { NativeFiltersForm, NativeFiltersFormItem } from '../types';
import { mapSemanticTypeToGenericDataType } from './utils';

interface ColumnSelectProps {
  allowClear?: boolean;
  filterValues?: (column: Column) => boolean;
  form: FormInstance<NativeFiltersForm>;
  formField?: keyof NativeFiltersFormItem;
  filterId: string;
  datasetId?: number;
  datasourceType?: string;
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
  const [columns, setColumns] = useState<Column[]>();
  const [loading, setLoading] = useState(false);
  const { addDangerToast } = useToasts();
  const resetColumnField = useCallback(() => {
    form.setFields([
      { name: ['filters', filterId, formField], touched: false, value: null },
    ]);
  }, [form, filterId, formField]);

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
  }, [currentColumn, currentFilterType, resetColumnField]);

  // Use a compound key so the effect re-fires when either the dataset ID or
  // the datasource type changes.  Datasets and semantic views have independent
  // ID sequences, so switching between them with the same numeric ID must still
  // trigger a column re-fetch.
  const datasourceKey = `${datasetId}__${datasourceType || 'table'}`;
  useChangeEffect(datasourceKey, previous => {
    if (previous != null) {
      setColumns([]);
      resetColumnField();
    }
    if (datasetId != null) {
      setLoading(true);
      const handleError = async (
        badResponse: Parameters<typeof getClientErrorObject>[0],
      ) => {
        const { error, message } = await getClientErrorObject(badResponse);
        let errorText = message || error || t('An error has occurred');
        if (message === 'Forbidden') {
          errorText = t('You do not have permission to edit this dashboard');
        }
        addDangerToast(errorText);
      };

      if (datasourceType === 'semantic_view') {
        cachedSupersetGet({
          endpoint: `/api/v1/semantic_view/${datasetId}/structure`,
        })
          .then((response: JsonResponse) => {
            const { dimensions = [] } = response.json?.result ?? {};
            const cols: Column[] = dimensions.map(
              (dim: { name: string; type: string }) => {
                const mappedType = mapSemanticTypeToGenericDataType(dim.type);
                return {
                  column_name: dim.name,
                  is_dttm: mappedType === GenericDataType.Temporal,
                  type_generic: mappedType,
                  filterable: true,
                };
              },
            );
            const lookupValue = Array.isArray(value) ? value : [value];
            const valueExists = cols.some((column: Column) =>
              lookupValue?.includes(column.column_name),
            );
            if (!valueExists) {
              resetColumnField();
            }
            setColumns(cols);
          }, handleError)
          .finally(() => setLoading(false));
      } else {
        cachedSupersetGet({
          endpoint: `/api/v1/dataset/${datasetId}?q=${rison.encode({
            columns: [
              'columns.column_name',
              'columns.is_dttm',
              'columns.type_generic',
              'columns.filterable',
            ],
          })}`,
        })
          .then(({ json: { result } }) => {
            const lookupValue = Array.isArray(value) ? value : [value];
            const valueExists = result.columns.some((column: Column) =>
              lookupValue?.includes(column.column_name),
            );
            if (!valueExists) {
              resetColumnField();
            }
            setColumns(result.columns);
          }, handleError)
          .finally(() => setLoading(false));
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
      placeholder={t('Select a column')}
      notFoundContent={t('No compatible columns found')}
      showSearch
      allowClear={allowClear}
    />
  );
}
