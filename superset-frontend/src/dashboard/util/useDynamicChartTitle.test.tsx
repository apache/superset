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
import {
  DataMaskStateWithId,
  DataMaskWithId,
  DatasourceType,
  ExtraFormData,
  Filter,
  NO_TIME_RANGE,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import mockState from 'spec/fixtures/mockState';
import { createSelectNativeFilter } from 'spec/fixtures/mockNativeFilters';
import reducerIndex from 'spec/helpers/reducerIndex';
import { act, createStore, render, screen } from 'spec/helpers/testing-library';
import { updateDataMask } from 'src/dataMask/actions';
import { ChartConfiguration, DynamicTitleConfig } from 'src/dashboard/types';
import { useDynamicChartTitle } from './useDynamicChartTitle';
import { hasNoTemporalTitleSupport } from './dynamicTitle';

const chartId = 18;
const filter = {
  ...createSelectNativeFilter('period-filter', 'Period'),
  filterType: 'filter_time',
  targets: [{}],
  chartsInScope: [chartId],
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
    dashboardState: { ...mockState.dashboardState, sliceIds: [chartId] },
    nativeFilters: {
      ...mockState.nativeFilters,
      filters: { [filter.id]: filter },
    },
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

const comparisonFilter: Filter = {
  ...filter,
  id: 'comparison-period-filter',
  name: 'Comparison period',
};

function timeMask(id: string, value?: string): DataMaskWithId {
  return {
    id,
    filterState: { value },
    extraFormData: value === undefined ? {} : { time_range: value },
  };
}

function makeScopedFiltersState(
  filters: Filter[],
  dataMask: DataMaskStateWithId,
  chartConfiguration: ChartConfiguration = {},
) {
  const state = makeState({
    datasource: {
      ...physicalDataset,
      column_types: [GenericDataType.String, GenericDataType.Temporal],
      columns: [{ is_dttm: true }],
    },
  });
  return {
    ...state,
    nativeFilters: {
      ...state.nativeFilters,
      filters: Object.fromEntries(filters.map(item => [item.id, item])),
    },
    dashboardInfo: {
      ...state.dashboardInfo,
      metadata: {
        native_filter_configuration: filters,
        chart_configuration: chartConfiguration,
      },
    },
    dataMask,
  };
}

test('falls back for an overridden period but displays the period used by the query', () => {
  render(
    <>
      <Probe />
      <Probe
        titleConfig={{
          ...config,
          tokenMappings: { period: comparisonFilter.id },
        }}
      />
    </>,
    {
      useRedux: true,
      initialState: makeScopedFiltersState([comparisonFilter, filter], {
        [filter.id]: timeMask(filter.id, 'Last week'),
        [comparisonFilter.id]: timeMask(comparisonFilter.id, 'Last year'),
      }),
    },
  );
  expect(screen.getByText('Revenue')).toBeVisible();
  expect(screen.getByText('Revenue in Last year')).toBeVisible();
  expect(screen.queryByText('Revenue in Last week')).not.toBeInTheDocument();
});

test('uses applied data-mask order rather than filter configuration order', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeScopedFiltersState([filter, comparisonFilter], {
      [comparisonFilter.id]: timeMask(comparisonFilter.id, 'Last year'),
      [filter.id]: timeMask(filter.id, 'Last week'),
    }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test.each([
  { inScope: true, expected: 'Revenue' },
  { inScope: false, expected: 'Revenue in Last week' },
])(
  'honors cross-filter time precedence only inside its scope: $inScope',
  ({ inScope, expected }) => {
    render(<Probe />, {
      useRedux: true,
      initialState: makeScopedFiltersState(
        [filter],
        {
          [filter.id]: timeMask(filter.id, 'Last week'),
          '42': timeMask('42', 'Last year'),
        },
        {
          42: {
            id: 42,
            crossFilters: {
              scope: { rootPath: ['ROOT_ID'], excluded: [] },
              chartsInScope: inScope ? [chartId] : [],
            },
          },
        },
      ),
    });
    expect(screen.getByText(expected)).toBeVisible();
  },
);

test('ignores an overriding native time mask outside the chart scope', () => {
  const outOfScopeFilter = {
    ...comparisonFilter,
    scope: { rootPath: ['ROOT_ID'], excluded: [chartId] },
    chartsInScope: [],
  };
  render(<Probe />, {
    useRedux: true,
    initialState: makeScopedFiltersState([filter, outOfScopeFilter], {
      [filter.id]: timeMask(filter.id, 'Last week'),
      [comparisonFilter.id]: timeMask(comparisonFilter.id, 'Last year'),
    }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test('preserves equal time values even when a later filter writes the same range', () => {
  render(<Probe />, {
    useRedux: true,
    initialState: makeScopedFiltersState([filter, comparisonFilter], {
      [filter.id]: timeMask(filter.id, 'Last week'),
      [comparisonFilter.id]: timeMask(comparisonFilter.id, 'Last week'),
    }),
  });
  expect(screen.getByText('Revenue in Last week')).toBeVisible();
});

test.each([
  { value: undefined, expected: 'Revenue in Last week' },
  { value: NO_TIME_RANGE, expected: 'Revenue' },
])(
  'distinguishes an empty time mask from an explicit no-filter override: $value',
  ({ value, expected }) => {
    render(<Probe />, {
      useRedux: true,
      initialState: makeScopedFiltersState([filter, comparisonFilter], {
        [filter.id]: timeMask(filter.id, 'Last week'),
        [comparisonFilter.id]: timeMask(comparisonFilter.id, value),
      }),
    });
    expect(screen.getByText(expected)).toBeVisible();
  },
);

test.each([
  {
    filterType: 'filter_timecolumn',
    extraKey: 'granularity_sqla',
    firstValue: 'ordered_at',
    secondValue: 'shipped_at',
  },
  {
    filterType: 'filter_timegrain',
    extraKey: 'time_grain_sqla',
    firstValue: 'P1D',
    secondValue: 'P1M',
  },
])(
  'falls back when another filter overrides the applied $filterType value',
  ({ filterType, extraKey, firstValue, secondValue }) => {
    render(
      <>
        <Probe />
        <Probe
          titleConfig={{
            ...config,
            tokenMappings: { period: comparisonFilter.id },
          }}
        />
      </>,
      {
        useRedux: true,
        initialState: makeScopedFiltersState(
          [
            { ...filter, filterType },
            { ...comparisonFilter, filterType },
          ],
          {
            [filter.id]: {
              id: filter.id,
              filterState: { value: [firstValue] },
              extraFormData: { [extraKey]: firstValue },
            },
            [comparisonFilter.id]: {
              id: comparisonFilter.id,
              filterState: { value: [secondValue] },
              extraFormData: { [extraKey]: secondValue },
            },
          },
        ),
      },
    );
    expect(screen.getByText('Revenue')).toBeVisible();
    expect(screen.getByText(`Revenue in ${secondValue}`)).toBeVisible();
    expect(
      screen.queryByText(`Revenue in ${firstValue}`),
    ).not.toBeInTheDocument();
  },
);

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
