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
import { useChangeEffect } from 'src/common/hooks/useChangeEffect';
import { AsyncSelect } from 'src/components/Select';
import { getChartDataRequest } from 'src/chart/chartAction';
import { NativeFiltersForm } from './types';

type SelectOption = {
  label: string;
  value: string;
};

interface DefaultValueSelectProps {
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  datasetId?: number | null | undefined;
  column?: SelectOption | string | null;
  value?: SelectOption | null;
  onChange?: (value: SelectOption | null) => void;
}

// eslint-disable-next-line import/prefer-default-export
export function DefaultValueSelect({
  form,
  filterId,
  datasetId,
  column,
  value,
  onChange,
}: DefaultValueSelectProps) {
  const resetFieldValue = useCallback(() => {
    form.setFields([
      {
        name: ['filters', filterId, 'defaultValue'],
        touched: false,
        value: null,
      },
    ]);
  }, [form, filterId]);

  useChangeEffect(datasetId, previous => {
    if (previous != null) {
      resetFieldValue();
    }
  });

  useChangeEffect(column, previous => {
    if (previous != null) {
      resetFieldValue();
    }
  });

  async function loadOptions() {
    if (datasetId == null || !column) return [];

    const formData = {
      datasource: `${datasetId}__table`,
      groupby: [column],
      metrics: ['count'],
      row_limit: 10000,
      viz_type: 'filter_select',
    };

    const response = await getChartDataRequest({
      formData,
      force: false,
      requestParams: { dashboardId: 0 },
    });

    return response.result[0].data.map((el: any) => el[column as string]);
  }

  return (
    <AsyncSelect
      // "key" prop makes react render a new instance of the select whenever the dataset changes
      key={`${datasetId}-${column}`}
      isDisabled={datasetId == null}
      value={value}
      onChange={onChange}
      isMulti={false}
      loadOptions={loadOptions}
      defaultOptions // load options on render
      cacheOptions
      isClearable
    />
  );
}
