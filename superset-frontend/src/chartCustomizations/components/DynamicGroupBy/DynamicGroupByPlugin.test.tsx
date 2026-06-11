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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PluginFilterDynamicGroupBy from './DynamicGroupByPlugin';
import transformProps from './transformProps';
import { PluginFilterGroupByProps } from './types';

const baseProps = {
  width: 220,
  height: 20,
  hooks: {},
  filterState: { value: [] },
  queriesData: [
    {
      data: [
        { column_name: 'banana' },
        { column_name: 'apple' },
        { column_name: 'cherry' },
      ],
    },
  ],
  formData: {
    datasource: '1__table',
    vizType: 'filter_groupby',
    nativeFilterId: 'test-filter',
    defaultValue: [],
    inputRef: { current: null },
  },
};

const renderPlugin = (sortAscending?: boolean) => {
  const chartProps = new ChartProps({
    ...baseProps,
    formData: { ...baseProps.formData, sortAscending },
    theme: supersetTheme,
  });
  return render(
    <PluginFilterDynamicGroupBy
      {...(transformProps(chartProps) as unknown as PluginFilterGroupByProps)}
    />,
  );
};

const getOpenedOptionOrder = async () => {
  userEvent.click(screen.getAllByRole('combobox')[0]);
  const options = await screen.findAllByRole('option');
  return options.map(option => option.textContent);
};

test('sorts display control values A-Z when sortAscending is true', async () => {
  renderPlugin(true);
  expect(await getOpenedOptionOrder()).toEqual(['apple', 'banana', 'cherry']);
});

test('sorts display control values Z-A when sortAscending is false', async () => {
  renderPlugin(false);
  expect(await getOpenedOptionOrder()).toEqual(['cherry', 'banana', 'apple']);
});

test('preserves source order when sorting is disabled', async () => {
  renderPlugin(undefined);
  expect(await getOpenedOptionOrder()).toEqual(['banana', 'apple', 'cherry']);
});
