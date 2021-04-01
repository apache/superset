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
import React, { FC, useEffect, useState } from 'react';
import { Behavior, SetDataMaskHook, SuperChart } from '@superset-ui/core';
import { FormInstance } from 'antd/lib/form';
import Loading from 'src/components/Loading';
import { NativeFiltersForm } from '../types';
import { getFormData } from '../../utils';

type DefaultValueProps = {
  filterId: string;
  setDataMask: SetDataMaskHook;
  hasDatasource: boolean;
  form: FormInstance<NativeFiltersForm>;
  formData: ReturnType<typeof getFormData>;
};

const DefaultValue: FC<DefaultValueProps> = ({
  filterId,
  hasDatasource,
  form,
  setDataMask,
  formData,
}) => {
  const [loading, setLoading] = useState(hasDatasource);
  const formFilter = (form.getFieldValue('filters') || {})[filterId];
  const queriesData = formFilter?.defaultValueQueriesData;

  useEffect(() => {
    if (!hasDatasource || queriesData !== null) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [hasDatasource, queriesData]);

  return loading ? (
    <Loading position="inline-centered" />
  ) : (
    <SuperChart
      height={25}
      width={250}
      behaviors={[Behavior.NATIVE_FILTER]}
      formData={formData}
      // For charts that don't have datasource we need workaround for empty placeholder
      queriesData={
        hasDatasource ? formFilter?.defaultValueQueriesData : [{ data: [{}] }]
      }
      chartType={formFilter?.filterType}
      hooks={{ setDataMask }}
    />
  );
};

export default DefaultValue;
