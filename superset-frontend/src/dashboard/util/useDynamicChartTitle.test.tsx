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
import { DatasourceType, ExtraFormData } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import mockState from 'spec/fixtures/mockState';
import { createSelectNativeFilter } from 'spec/fixtures/mockNativeFilters';
import reducerIndex from 'spec/helpers/reducerIndex';
import { act, createStore, render, screen } from 'spec/helpers/testing-library';
import { updateDataMask } from 'src/dataMask/actions';
import { DynamicTitleConfig } from 'src/dashboard/types';
import { useDynamicChartTitle } from './useDynamicChartTitle';
import { hasNoTemporalTitleSupport } from './dynamicTitle';

const chartId = 18;
const filter = {
  ...createSelectNativeFilter('period-filter', 'Period'),
  filterType: 'filter_time',
  targets: [{}],
};
const config = {
  template: '{{chart_title}} in {{period}}',
  tokenMappings: { period: filter.id },
};
const physicalDataset = {
  ...mockState.datasources['7__table'],
  type: DatasourceType.Table,
  sql: null,
  column_types: [GenericDataType.String, GenericDataType.Numeric],
  columns: [{ column_name: 'country', is_dttm: false }],
};

function makeState({
  datasource = physicalDataset,
  extraFormData = { time_range: 'Last week' },
  rejected = [],
  applied = [],
  datasourceUid = '7__table',
}: {
  datasource?: Parameters<typeof hasNoTemporalTitleSupport>[0];
  extraFormData?: ExtraFormData;
  rejected?: string[];
  applied?: string[];
  datasourceUid?: string;
} = {}) {
  return {
    ...mockState,
    datasources: { '7__table': datasource },
    charts: {
      [chartId]: {
        ...mockState.charts[chartId],
        form_data: {
          ...mockState.charts[chartId].form_data,
          datasource: datasourceUid,
        },
        queriesResponse: [
          {
            rejected_filters: rejected.map(column => ({ column })),
            applied_filters: applied.map(column => ({ column })),
          },
        ],
      },
    },
    dashboardLayout: {
      past: [],
      future: [],
      present: {
        CHART: {
          id: 'CHART',
          type: 'CHART',
          children: [],
          parents: ['ROOT_ID'],
          meta: { chartId },
        },
      },
    },
    dashboardInfo: {
      ...mockState.dashboardInfo,
      metadata: { native_filter_configuration: [filter] },
    },
    dataMask: {
      [filter.id]: {
        id: filter.id,
        filterState: { value: 'Last week' },
        extraFormData,
      },
    },
  };
}

function Probe({
  titleConfig = config,
  onRender = () => {},
}: {
  titleConfig?: DynamicTitleConfig | null;
  onRender?: () => void;
}) {
  const { title } = useDynamicChartTitle(
    chartId,
    'Revenue',
    titleConfig ?? undefined,
  );
  onRender();
  return <span>{title}</span>;
}

test('ignores time on a physical dataset proven to have no temporal columns', () => {
  render(<Probe />, { useRedux: true, initialState: makeState() });
  expect(screen.getByText('Revenue')).toBeVisible();
});

test.each([
  ['__time_range', { time_range: 'Last week' }],
  ['__time_col', { granularity_sqla: 'ds' }],
  ['__time_grain', { time_grain_sqla: 'P1D' }],
] satisfies [string, ExtraFormData][])(
  'honors explicit query rejection of %s even without a target column',
  (column, extraFormData) => {
    render(<Probe />, {
      useRedux: true,
      initialState: makeState({
        datasource: { ...physicalDataset, sql: 'SELECT * FROM sales' },
        rejected: [column],
        extraFormData,
      }),
    });
    expect(screen.getByText('Revenue')).toBeVisible();
  },
);

test('trusts explicit query application over temporal metadata inference', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeState({ applied: ['__time_range'] }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test.each([
  { ...physicalDataset, sql: 'SELECT * FROM sales' },
  { ...physicalDataset, sql: undefined },
  { ...physicalDataset, column_types: undefined },
  { ...physicalDataset, column_types: [] },
  { ...physicalDataset, columns: undefined },
  { ...physicalDataset, columns: [{ column_name: 'ds', is_dttm: true }] },
  { ...physicalDataset, columns: [{ column_name: 'ds', is_dttm: undefined }] },
  { ...physicalDataset, type: DatasourceType.SemanticView },
])(
  'does not infer rejection for virtual or unknown metadata %p',
  datasource => {
    render(<Probe />, {
      useRedux: true,
      initialState: makeState({ datasource }),
    });
    expect(screen.getByText('Revenue in Last week')).toBeVisible();
  },
);

test('uses full dataset types for an aggregate chart with no projected columns', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeState({
      datasource: { ...physicalDataset, columns: [] },
    }),
  });
  expect(screen.getByText('Revenue')).toBeVisible();
});

test('uses full dataset column types when the dashboard omits the temporal column', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeState({
      datasource: {
        ...physicalDataset,
        column_types: [GenericDataType.String, GenericDataType.Temporal],
      },
    }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test('looks up the full datasource UID without conflating semantic views and tables', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeState({ datasourceUid: '7__semantic_view' }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test('does not rerender disabled titles for applied filter changes', () => {
  const store = createStore(makeState(), reducerIndex);
  const onRender = jest.fn();
  render(<Probe titleConfig={null} onRender={onRender} />, {
    useRedux: true,
    store,
  });
  const renders = onRender.mock.calls.length;
  act(() => {
    store.dispatch(
      updateDataMask(filter.id, { filterState: { value: 'Today' } }),
    );
  });
  expect(onRender).toHaveBeenCalledTimes(renders);
  expect(screen.getByText('Revenue')).toBeVisible();
});
