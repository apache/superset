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
import { action } from '@storybook/addon-actions';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { mockQueryDataForCountries } from 'spec/fixtures/mockNativeFilters';
import SelectFilterPlugin from './index';
import transformProps from './transformProps';

new SelectFilterPlugin().configure({ key: 'filter_select' }).register();

getChartTransformPropsRegistry().registerValue('filter_select', transformProps);

export default {
  title: 'Filter Plugins',
  argTypes: {
    multiSelect: { control: 'boolean', defaultValue: true },
    inverseSelection: { control: 'boolean', defaultValue: false },
  },
};

export const Select = ({
  multiSeelct,
  inverseSelection,
  width,
  height,
}: {
  multiSeelct: boolean;
  inverseSelection: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType="filter_select"
    width={width}
    height={height}
    queriesData={[{ data: mockQueryDataForCountries }]}
    formData={{
      adhoc_filters: [],
      extra_filters: [],
      multiSelect: { multiSeelct },
      inverseSelection: { inverseSelection },
      row_limit: 1000,
      viz_type: 'filter_select',
      groupby: ['country_name'],
      metrics: ['SUM(SP_POP_TOTL)'],
    }}
    hooks={{
      setDataMask: action('setDataMask'),
    }}
  />
);
