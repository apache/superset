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
import React, { useCallback } from 'react';
import { FormInstance } from 'antd/lib/form';
import { SupersetClient, t } from '@superset-ui/core';
import { useChangeEffect } from 'src/common/hooks/useChangeEffect';
import { AsyncSelect } from 'src/components/Select';
import { useToasts } from 'src/messageToasts/enhancers/withToasts';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import { NativeFiltersForm } from './types';

type ColumnSelectValue = {
  value: string;
  label: string;
};

interface ColumnSelectProps {
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  datasetId?: number | null | undefined;
  value?: ColumnSelectValue | null;
  onChange?: (value: ColumnSelectValue | null) => void;
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
  form,
  filterId,
  datasetId,
  value,
  onChange,
}: ColumnSelectProps) {
  const { addDangerToast } = useToasts();
  const resetColumnField = useCallback(() => {
    form.setFields([
      { name: ['filters', filterId, 'column'], touched: false, value: null },
    ]);
  }, [form, filterId]);
  useChangeEffect(datasetId, previous => {
    if (previous != null) {
      resetColumnField();
    }
  });

  function loadOptions() {
    if (datasetId == null) return [];
    return cachedSupersetGet({
      endpoint: `/api/v1/dataset/${datasetId}`,
    }).then(
      ({ json: { result } }) => {
        return result.columns
          .map((col: any) => col.column_name)
          .sort((a: string, b: string) => a.localeCompare(b));
      },
      async badResponse => {
        const { error, message } = await getClientErrorObject(badResponse);
        let errorText = message || error || t('An error has occurred');
        if (message === 'Forbidden') {
          errorText = t('You do not have permission to edit this dashboard');
        }
        addDangerToast(errorText);
        return [];
      },
    );
  }

  return (
    <AsyncSelect
      // "key" prop makes react render a new instance of the select whenever the dataset changes
      key={datasetId == null ? '*no dataset*' : datasetId}
      isDisabled={datasetId == null}
      value={value}
      onChange={onChange}
      isMulti={false}
      loadOptions={loadOptions}
      defaultOptions // load options on render
      cacheOptions
    />
  );
}
