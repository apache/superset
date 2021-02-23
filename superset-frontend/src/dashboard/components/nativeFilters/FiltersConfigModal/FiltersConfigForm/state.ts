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
import { useEffect } from 'react';
import { FormInstance } from 'antd/lib/form';
import { getChartDataRequest } from 'src/chart/chartAction';
import { NativeFiltersForm } from '../types';
import { setFilterFieldValues, useForceUpdate } from './utils';
import { Filter } from '../../types';
import { getFormData } from '../../utils';

// When some fields in form changed we need re-fetch data for Filter defaultValue
// eslint-disable-next-line import/prefer-default-export
export const useBackendFormUpdate = (
  form: FormInstance<NativeFiltersForm>,
  filterId: string,
  filterToEdit?: Filter,
  hasDatasource?: boolean,
) => {
  const forceUpdate = useForceUpdate();
  const formFilter = (form.getFieldValue('filters') || {})[filterId];
  useEffect(() => {
    let resolvedDefaultValue: any = null;
    if (!hasDatasource) {
      forceUpdate();
      return;
    }
    // No need to check data set change because it cascading update column
    // So check that column exists is enough
    if (!formFilter?.column) {
      setFilterFieldValues(form, filterId, {
        defaultValueQueriesData: [],
        defaultValue: resolvedDefaultValue,
      });
      return;
    }
    const formData = getFormData({
      datasetId: formFilter?.dataset?.value,
      groupby: formFilter?.column,
      defaultValue: formFilter?.defaultValue,
      ...formFilter,
    });
    getChartDataRequest({
      formData,
      force: false,
      requestParams: { dashboardId: 0 },
    }).then(response => {
      if (
        filterToEdit?.filterType === formFilter?.filterType &&
        filterToEdit?.targets[0].datasetId === formFilter?.dataset?.value &&
        formFilter?.column === filterToEdit?.targets[0].column?.name
      ) {
        resolvedDefaultValue = filterToEdit?.defaultValue;
      }
      setFilterFieldValues(form, filterId, {
        defaultValueQueriesData: response.result,
        defaultValue: resolvedDefaultValue,
      });
      forceUpdate();
    });
  }, [
    formFilter?.filterType,
    formFilter?.column,
    formFilter?.dataset?.value,
    filterId,
  ]);
};
