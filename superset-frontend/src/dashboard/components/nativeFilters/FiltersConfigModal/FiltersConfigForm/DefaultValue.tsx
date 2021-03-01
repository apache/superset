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
import React, { FC } from 'react';
import { t, SuperChart } from '@superset-ui/core';
import { FormInstance } from 'antd/lib/form';
import { setFilterFieldValues, useForceUpdate } from './utils';
import { StyledFormItem, StyledLabel } from './FiltersConfigForm';
import { Filter } from '../../types';
import { NativeFiltersForm } from '../types';
import { getFormData } from '../../utils';

type DefaultValueProps = {
  filterId: string;
  hasFilledDatasource: boolean;
  hasDatasource: boolean;
  filterToEdit?: Filter;
  form: FormInstance<NativeFiltersForm>;
  formData: ReturnType<typeof getFormData>;
};

const DefaultValue: FC<DefaultValueProps> = ({
  filterId,
  hasFilledDatasource,
  hasDatasource,
  filterToEdit,
  form,
  formData,
}) => {
  const forceUpdate = useForceUpdate();
  const formFilter = (form.getFieldValue('filters') || {})[filterId];
  return (
    <StyledFormItem
      name={['filters', filterId, 'defaultValue']}
      initialValue={filterToEdit?.defaultValue}
      data-test="default-input"
      label={<StyledLabel>{t('Default Value')}</StyledLabel>}
    >
      {((hasFilledDatasource && formFilter?.defaultValueQueriesData) ||
        !hasDatasource) && (
        <SuperChart
          height={25}
          width={250}
          formData={formData}
          // For charts that don't have datasource we need workaround for empty placeholder
          queriesData={
            hasDatasource
              ? formFilter?.defaultValueQueriesData
              : [{ data: [null] }]
          }
          chartType={formFilter?.filterType}
          hooks={{
            // @ts-ignore (fixed in other PR)
            setExtraFormData: ({ currentState }) => {
              setFilterFieldValues(form, filterId, {
                defaultValue: currentState?.value,
              });
              forceUpdate();
            },
          }}
        />
      )}
    </StyledFormItem>
  );
};

export default DefaultValue;
