import { DatasourceType } from '@superset-ui/core';
import { EchartsTimeseriesChartProps } from '@superset-ui/plugin-chart-echarts';
import { EchartsMixedTimeseriesProps } from 'plugins/plugin-chart-echarts/src/MixedTimeseries/types';

export const mockedTimeSeriesProps: EchartsTimeseriesChartProps = {
  // Datasource metadata
  datasource: {
    id: 1,
    name: 'test_datasource',
    type: DatasourceType.Table,
    columnFormats: {},
    currencyFormats: {},
    verboseMap: {
      testing_count: 'Testing count',
      'SUM(money_for_learning)': 'SUM(money_for_learning)',
      time_start: 'time_start',
    },
  },

  // Query results
  queriesData: [
    {
      label_map: {
        time_start: ['time_start'],
        'SUM(money_for_learning)': ['SUM(money_for_learning)'],
        'SUM(money_for_learning), 1 day ago': [
          'SUM(money_for_learning)',
          '1 day ago',
        ],
        'SUM(money_for_learning), 1 week ago': [
          'SUM(money_for_learning)',
          '1 week ago',
        ],
        'SUM(money_for_learning), 1 year ago': [
          'SUM(money_for_learning)',
          '1 year ago',
        ],
        testing_count: ['testing_count'],
        'testing_count, 1 day ago': ['testing_count', '1 day ago'],
        'testing_count, 1 week ago': ['testing_count', '1 week ago'],
        'testing_count, 1 year ago': ['testing_count', '1 year ago'],
        'Testing count': ['testing_count'],
      },
      colnames: [
        'time_start',
        'SUM(money_for_learning)',
        'SUM(money_for_learning), 1 day ago',
        'SUM(money_for_learning), 1 week ago',
        'SUM(money_for_learning), 1 year ago',
        'testing_count',
        'testing_count, 1 day ago',
        'testing_count, 1 week ago',
        'testing_count, 1 year ago',
      ],
      indexnames: [0, 1, 2],
      coltypes: [2, 0, 0, 0, 1, 0, 0, 0, 1],
      data: [
        {
          time_start: 1533081600001,
          'SUM(money_for_learning)': 101,
          'SUM(money_for_learning), 1 day ago': null,
          'SUM(money_for_learning), 1 week ago': null,
          'SUM(money_for_learning), 1 year ago': null,
          testing_count: 1,
          'testing_count, 1 day ago': null,
          'testing_count, 1 week ago': null,
          'testing_count, 1 year ago': null,
        },
        {
          time_start: 1533168000001,
          'SUM(money_for_learning)': 5791,
          'SUM(money_for_learning), 1 day ago': 101,
          'SUM(money_for_learning), 1 week ago': null,
          'SUM(money_for_learning), 1 year ago': null,
          testing_count: 131,
          'testing_count, 1 day ago': 11,
          'testing_count, 1 week ago': null,
          'testing_count, 1 year ago': null,
        },
      ],
      result_format: 'json',
      applied_filters: [
        {
          column: 'time_start',
        },
      ],
      rejected_filters: [],
    },
  ],

  // Filter and legend state
  filterState: {
    selectedValues: [],
  },
  legendState: {},

  // Form data (chart configuration)
  formData: {
    metrics: [
      {
        aggregate: 'SUM',
        column: {
          column_name: 'money_for_learning',
          filterable: true,
          groupby: true,
          id: 460,
          is_dttm: false,
          type: 'DOUBLE PRECISION',
          type_generic: 0,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: false,
        label: 'SUM(money_for_learning)',
        optionName: 'metric_olnflt1ak9g_z1vjg3dhmnf',
      },
      'testing_count',
    ],
  },

  // Hooks
  hooks: {
    setDataMask: () => {},
    setControlValue: () => {},
    onContextMenu: () => {},
    onLegendStateChanged: () => {},
    onLegendScroll: () => {},
  },

  // UI state
  inContextMenu: false,
  emitCrossFilters: true,
  legendIndex: 0,

  // Raw form data (needed for additional validation)
  rawFormData: {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    x_axis: 'ds',
    time_compare: [],
  },

  // Theme
  theme: {},
} as any;

export const mockedMixedTimeSeriesProps: EchartsMixedTimeseriesProps = {
  // Datasource metadata
  ...mockedTimeSeriesProps,

  // Query results
  queriesData: [
    mockedTimeSeriesProps.queriesData?.[0] || {},
    {
      label_map: {
        time_start: ['time_start'],
        'SUM(money_for_learning)': ['SUM(money_for_learning)'],
        'SUM(money_for_learning), 1 day ago': [
          'SUM(money_for_learning)',
          '1 day ago',
        ],
        'SUM(money_for_learning), 1 week ago': [
          'SUM(money_for_learning)',
          '1 week ago',
        ],
        'SUM(money_for_learning), 1 year ago': [
          'SUM(money_for_learning)',
          '1 year ago',
        ],
        testing_count: ['testing_count'],
        'testing_count, 1 day ago': ['testing_count', '1 day ago'],
        'testing_count, 1 week ago': ['testing_count', '1 week ago'],
        'testing_count, 1 year ago': ['testing_count', '1 year ago'],
        'Testing count': ['testing_count'],
      },
      colnames: [
        'time_start',
        'SUM(money_for_learning)',
        'SUM(money_for_learning), 1 day ago',
        'SUM(money_for_learning), 1 week ago',
        'SUM(money_for_learning), 1 year ago',
        'testing_count',
        'testing_count, 1 day ago',
        'testing_count, 1 week ago',
        'testing_count, 1 year ago',
      ],
      indexnames: [0, 1, 2],
      coltypes: [2, 0, 0, 0, 1, 0, 0, 0, 1],
      data: [
        {
          time_start: 1533081600000,
          'SUM(money_for_learning)': 100,
          'SUM(money_for_learning), 1 day ago': null,
          'SUM(money_for_learning), 1 week ago': null,
          'SUM(money_for_learning), 1 year ago': null,
          testing_count: 1,
          'testing_count, 1 day ago': null,
          'testing_count, 1 week ago': null,
          'testing_count, 1 year ago': null,
        },
        {
          time_start: 1533168000000,
          'SUM(money_for_learning)': 5790,
          'SUM(money_for_learning), 1 day ago': 100,
          'SUM(money_for_learning), 1 week ago': null,
          'SUM(money_for_learning), 1 year ago': null,
          testing_count: 13,
          'testing_count, 1 day ago': 1,
          'testing_count, 1 week ago': null,
          'testing_count, 1 year ago': null,
        },
      ],
      result_format: 'json',
      applied_filters: [
        {
          column: 'time_start',
        },
      ],
      rejected_filters: [],
    },
  ],

  // Filter and legend state
  filterState: {
    selectedValues: [],
  },
  legendState: {},

  // Form data (chart configuration)
  formData: {
    metrics: mockedTimeSeriesProps.formData?.metrics || [],
    metricsB: [
      {
        aggregate: 'SUM',
        column: {
          column_name: 'money_for_learning',
          filterable: true,
          groupby: true,
          id: 460,
          is_dttm: false,
          type: 'DOUBLE PRECISION',
          type_generic: 0,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: false,
        label: 'SUM(money_for_learning)',
        optionName: 'metric_olnflt1ak9g_z1vjg3dhmnf',
      },
      'testing_count',
    ],
  },
} as any;
