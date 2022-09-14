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
import { FeatureFlag, GenericDataType } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocFilter, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import {
  DndFilterSelect,
  DndFilterSelectProps,
} from 'src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import { TimeseriesDefaultFormData } from '@superset-ui/plugin-chart-echarts';

const defaultProps: DndFilterSelectProps = {
  type: 'DndFilterSelect',
  name: 'Filter',
  value: [],
  columns: [],
  datasource: PLACEHOLDER_DATASOURCE,
  formData: null,
  savedMetrics: [],
  selectedMetrics: [],
  onChange: jest.fn(),
  actions: { setControlValue: jest.fn() },
};

const baseFormData = {
  viz_type: 'my_viz',
  datasource: 'table__1',
};

beforeAll(() => {
  window.featureFlags = { [FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP]: true };
});

afterAll(() => {
  window.featureFlags = {};
});

test('renders with default props', async () => {
  render(<DndFilterSelect {...defaultProps} />, { useDnd: true });
  expect(
    await screen.findByText('Drop columns or metrics here'),
  ).toBeInTheDocument();
});

test('renders with value', async () => {
  const value = new AdhocFilter({
    sqlExpression: 'COUNT(*)',
    expressionType: EXPRESSION_TYPES.SQL,
  });
  render(<DndFilterSelect {...defaultProps} value={[value]} />, {
    useDnd: true,
  });
  expect(await screen.findByText('COUNT(*)')).toBeInTheDocument();
});

test('renders options with saved metric', async () => {
  render(
    <DndFilterSelect
      {...defaultProps}
      formData={{
        ...baseFormData,
        ...TimeseriesDefaultFormData,
        metrics: ['saved_metric'],
      }}
    />,
    {
      useDnd: true,
    },
  );
  expect(
    await screen.findByText('Drop columns or metrics here'),
  ).toBeInTheDocument();
});

test('renders options with column', async () => {
  render(
    <DndFilterSelect
      {...defaultProps}
      columns={[
        {
          id: 1,
          type: 'VARCHAR',
          type_generic: GenericDataType.STRING,
          column_name: 'Column',
        },
      ]}
    />,
    {
      useDnd: true,
    },
  );
  expect(
    await screen.findByText('Drop columns or metrics here'),
  ).toBeInTheDocument();
});

test('renders options with adhoc metric', async () => {
  const adhocMetric = new AdhocMetric({
    expression: 'AVG(birth_names.num)',
    metric_name: 'avg__num',
  });
  render(
    <DndFilterSelect
      {...defaultProps}
      formData={{
        ...baseFormData,
        ...TimeseriesDefaultFormData,
        metrics: [adhocMetric],
      }}
    />,
    {
      useDnd: true,
    },
  );
  expect(
    await screen.findByText('Drop columns or metrics here'),
  ).toBeInTheDocument();
});
