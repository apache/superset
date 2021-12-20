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
import React from 'react';
import { action } from '@storybook/addon-actions';
import {
  SuperChart,
  getChartTransformPropsRegistry,
  GenericDataType,
} from '@superset-ui/core';
import RangeFilterPlugin from './index';
import transformProps from './transformProps';

new RangeFilterPlugin().configure({ key: 'filter_range' }).register();

getChartTransformPropsRegistry().registerValue('filter_range', transformProps);

export default {
  title: 'Filter Plugins',
};

export const range = ({ width, height }: { width: number; height: number }) => (
  <SuperChart
    chartType="filter_range"
    width={width}
    height={height}
    queriesData={[{ data: [{ min: 10, max: 100 }] }]}
    filterState={{ value: [10, 70] }}
    formData={{
      groupby: ['SP_POP_TOTL'],
      adhoc_filters: [],
      extra_filters: [],
      viz_type: 'filter_range',
      metrics: [
        {
          aggregate: 'MIN',
          column: {
            column_name: 'SP_POP_TOTL',
            id: 1,
            type_generic: GenericDataType.NUMERIC,
          },
          expressionType: 'SIMPLE',
          hasCustomLabel: true,
          label: 'min',
        },
        {
          aggregate: 'MAX',
          column: {
            column_name: 'SP_POP_TOTL',
            id: 2,
            type_generic: GenericDataType.NUMERIC,
          },
          expressionType: 'SIMPLE',
          hasCustomLabel: true,
          label: 'max',
        },
      ],
    }}
    hooks={{
      setDataMask: action('setDataMask'),
    }}
  />
);
