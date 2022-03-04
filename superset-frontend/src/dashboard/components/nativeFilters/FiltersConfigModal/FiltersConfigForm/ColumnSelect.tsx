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
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { Column, ensureIsArray, SupersetClient, t } from '@superset-ui/core';
import { useChangeEffect } from 'src/hooks/useChangeEffect';
import { Select, FormInstance } from 'src/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import { NativeFiltersForm } from '../types';
import { doesColumnMatchFilterType } from './utils';

interface ColumnSelectProps {
  allowClear?: boolean;
  filterValues?: (column: Column) => boolean;
  form: FormInstance<NativeFiltersForm>;
  formField?: string;
  filterId: string;
  datasetId?: number;
  value?: string | string[];
  onChange?: (value: string) => void;
  mode?: 'multiple';
}

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

/** Special purpose AsyncSelect that selects a column from a dataset */
// eslint-disable-next-line import/prefer-default-export
export function ColumnSelect({
  allowClear = false,
  filterValues = () => true,
  form,
  formField = 'column',
  filterId,
  datasetId,
  value,
  onChange,
  mode,
}: ColumnSelectProps) {
  const [columns, setColumns] = useState<Column[]>();
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
    if (
      currentColumn &&
      !doesColumnMatchFilterType(currentFilterType, currentColumn)
    ) {
      resetColumnField();
    }
  }, [currentColumn, currentFilterType, resetColumnField]);

  useChangeEffect(datasetId, previous => {
    if (previous != null) {
      resetColumnField();
    }
    if (datasetId != null) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      }).then(
        ({ json: { result } }) => {
          const lookupValue = Array.isArray(value) ? value : [value];
          const valueExists = result.columns.some((column: Column) =>
            lookupValue?.includes(column.column_name),
          );
          if (!valueExists) {
            resetColumnField();
          }
          setColumns(result.columns);
        },
        async badResponse => {
          const { error, message } = await getClientErrorObject(badResponse);
          let errorText = message || error || t('An error has occurred');
          if (message === 'Forbidden') {
            errorText = t('You do not have permission to edit this dashboard');
          }
          addDangerToast(errorText);
        },
      );
    }
  });

  return (
    <Select
      mode={mode}
      value={mode === 'multiple' ? value || [] : value}
      ariaLabel={t('Column select')}
      onChange={onChange}
      options={options}
      placeholder={t('Select a column')}
      notFoundContent={t('No compatible columns found')}
      showSearch
      allowClear={allowClear}
    />
  );
}
