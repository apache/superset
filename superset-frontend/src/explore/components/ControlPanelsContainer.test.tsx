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
import { useSelector } from 'react-redux';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { t } from '@apache-superset/core/translation';
import {
  DatasourceType,
  getChartControlPanelRegistry,
  isFeatureEnabled,
  FeatureFlag,
  NO_TIME_RANGE,
} from '@superset-ui/core';
import { Dataset, sharedControls } from '@superset-ui/chart-controls';
import { defaultControls, defaultState } from 'src/explore/store';
import { ExplorePageState } from 'src/explore/types';
import {
  getControlStateFromControlConfig,
  getFormDataFromControls,
} from 'src/explore/controlUtils';
import {
  ControlPanelsContainer,
  ControlPanelsContainerProps,
} from 'src/explore/components/ControlPanelsContainer';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
  fetchTimeRange: jest.fn(async () => ({ value: 'Actual time range' })),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const FormDataMock = () => {
  const formData = useSelector(
    (state: ExplorePageState) => state.explore.form_data,
  );

  return <div data-test="mock-formdata">{Object.keys(formData).join(':')}</div>;
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ControlPanelsContainer', () => {
  const defaultTableConfig = {
    controlPanelSections: [
      {
        label: t('GROUP BY'),
        description: t('Use this section if you want a query that aggregates'),
        expanded: true,
        controlSetRows: [
          ['groupby'],
          ['metrics'],
          ['percent_metrics'],
          ['timeseries_limit_metric', 'row_limit'],
          ['include_time', 'order_desc'],
        ],
      },
      {
        label: t('NOT GROUPED BY'),
        description: t('Use this section if you want to query atomic rows'),
        expanded: true,
        controlSetRows: [
          ['all_columns'],
          ['order_by_cols'],
          ['row_limit', null],
        ],
      },
      {
        label: t('Query'),
        expanded: true,
        controlSetRows: [['adhoc_filters']],
      },
      {
        label: t('Options'),
        expanded: true,
        controlSetRows: [
          ['table_timestamp_format'],
          ['page_length', null],
          ['include_search', 'table_filter'],
          ['align_pn', 'color_pn'],
        ],
      },
    ],
  };

  beforeEach(() => {
    getChartControlPanelRegistry().registerValue('table', defaultTableConfig);
    jest.clearAllMocks();
    // Default: feature disabled
    mockIsFeatureEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    getChartControlPanelRegistry().remove('table');
    jest.clearAllMocks();
  });

  afterAll(() => {
    getChartControlPanelRegistry().remove('table');
  });

  function getDefaultProps() {
    const controls = defaultControls as ControlPanelsContainerProps['controls'];
    return {
      datasource_type: DatasourceType.Table,
      actions: {},
      controls,
      form_data: getFormDataFromControls(controls),
      isDatasourceMetaLoading: false,
      exploreState: {},
      chart: {
        queriesResponse: null,
        chartStatus: 'success',
      },
    } as ControlPanelsContainerProps;
  }

  test('renders ControlPanelSections', async () => {
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });
    await waitFor(() => {
      expect(
        screen.getAllByTestId('collapsible-control-panel-header'),
      ).toHaveLength(4);
    });
    expect(screen.getByRole('tab', { name: /customize/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /customize/i }));
    await waitFor(() => {
      expect(
        screen.getAllByTestId('collapsible-control-panel-header'),
      ).toHaveLength(5);
    });
  });

  test('renders ControlPanelSections no Customize Tab', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('GROUP BY'),
          description: t(
            'Use this section if you want a query that aggregates',
          ),
          expanded: true,
          controlSetRows: [
            ['groupby'],
            ['metrics'],
            ['percent_metrics'],
            ['timeseries_limit_metric', 'row_limit'],
            ['include_time', 'order_desc'],
          ],
        },
        {
          label: t('Options'),
          expanded: true,
          controlSetRows: [],
        },
      ],
    });
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });
    expect(screen.queryByText(/customize/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getAllByTestId('collapsible-control-panel-header'),
      ).toHaveLength(2);
    });
  });

  test('visibility of panels is correctly applied', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Advanced analytics'),
          description: t('Advanced analytics post processing'),
          expanded: true,
          controlSetRows: [['groupby'], ['metrics'], ['percent_metrics']],
          visibility: () => false,
        },
        {
          label: t('Chart Title'),
          visibility: () => true,
          controlSetRows: [['timeseries_limit_metric', 'row_limit']],
        },
        {
          label: t('Chart Options'),
          controlSetRows: [['include_time', 'order_desc']],
        },
      ],
    });
    const { getByTestId } = render(
      <>
        <ControlPanelsContainer {...getDefaultProps()} />
        <FormDataMock />
      </>,
      {
        useRedux: true,
        initialState: { explore: { form_data: defaultState.form_data } },
      },
    );

    const disabledSection = screen.queryByRole('button', {
      name: /advanced analytics/i,
    });
    expect(disabledSection).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /chart title/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /chart options/i }),
    ).toBeInTheDocument();

    expect(getByTestId('mock-formdata')).not.toHaveTextContent('groupby');
    expect(getByTestId('mock-formdata')).not.toHaveTextContent('metrics');
    expect(getByTestId('mock-formdata')).not.toHaveTextContent(
      'percent_metrics',
    );
  });

  test('renders section with function label and description', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: () => t('Dynamic Section Label'),
          description: () => t('Dynamic section description'),
          expanded: true,
          controlSetRows: [['groupby']],
        },
      ],
    });
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });
    await waitFor(() => {
      expect(screen.getByText('Dynamic Section Label')).toBeInTheDocument();
    });
  });

  test('hidden state of controls is correctly applied', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Time Comparison'),
          expanded: true,
          controlSetRows: [
            [
              {
                name: 'time_compare',
                config: {
                  type: 'SelectControl',
                  freeForm: true,
                  label: t('Time shift'),
                  choices: [],
                },
              },
            ],
            [
              {
                name: 'start_date_offset',
                config: {
                  type: 'SelectControl',
                  choices: [],
                  label: t('Shift start date'),
                  hidden: true,
                },
              },
            ],
            [
              {
                name: 'comparison_type',
                config: {
                  type: 'SelectControl',
                  label: t('Calculation type'),
                  default: 'values',
                  choices: [],
                  hidden: () => true,
                },
              },
            ],
          ],
        },
      ],
    });
    render(<ControlPanelsContainer {...getDefaultProps()} />, {
      useRedux: true,
    });

    expect(screen.getByText('Time shift')).toBeInTheDocument();
    expect(screen.getByText('Shift start date')).toBeInTheDocument();
    expect(screen.getByText('Calculation type')).toBeInTheDocument();
    expect(screen.getByText('Shift start date')).not.toBeVisible();
    expect(screen.getByText('Calculation type')).not.toBeVisible();
  });

  test('should stay on Matrixify tab when matrixify is enabled', async () => {
    // Enable Matrixify feature flag
    mockIsFeatureEnabled.mockImplementation(
      (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.Matrixify,
    );

    // Register control panel for line chart
    getChartControlPanelRegistry().registerValue('line', {
      controlPanelSections: [],
    });

    const props = getDefaultProps();
    // Use a chart type that supports matrixify (not a table)
    props.form_data = {
      ...props.form_data,
      viz_type: 'line',
      matrixify_enable: true,
      matrixify_mode_rows: 'metrics',
    };

    const { rerender } = render(<ControlPanelsContainer {...props} />, {
      useRedux: true,
    });

    // Check that Matrixify tab exists and is active
    await waitFor(() => {
      const matrixifyTab = screen.getByRole('tab', { name: /matrixify/i });
      expect(matrixifyTab).toBeInTheDocument();
      expect(matrixifyTab).toHaveAttribute('aria-selected', 'true');
    });

    // Simulate saving with updated dimension values
    const updatedProps = {
      ...props,
      form_data: {
        ...props.form_data,
        viz_type: 'line',
        matrixify_enable: true,
        matrixify_mode_rows: 'metrics',
        matrixify_dimension_columns: {
          dimension: 'country',
          values: ['USA', 'Canada'],
        },
      },
    };

    rerender(<ControlPanelsContainer {...updatedProps} />);

    // Matrixify tab should still be active after rerender
    await waitFor(() => {
      const matrixifyTabAfterSave = screen.getByRole('tab', {
        name: /matrixify/i,
      });
      expect(matrixifyTabAfterSave).toHaveAttribute('aria-selected', 'true');
    });

    // Clean up
    getChartControlPanelRegistry().remove('line');
  });

  test('should automatically switch to Matrixify tab when matrixify becomes enabled', async () => {
    // Enable Matrixify feature flag
    mockIsFeatureEnabled.mockImplementation(
      (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.Matrixify,
    );

    // Register control panel for line chart
    getChartControlPanelRegistry().registerValue('line', {
      controlPanelSections: [],
    });

    const props = getDefaultProps();
    // Use a chart type that supports matrixify (not a table)
    props.form_data = {
      ...props.form_data,
      viz_type: 'line',
    };

    const { rerender } = render(<ControlPanelsContainer {...props} />, {
      useRedux: true,
    });

    // Initially, Data tab should be active
    const dataTab = screen.getByRole('tab', { name: /data/i });
    expect(dataTab).toHaveAttribute('aria-selected', 'true');

    // Enable matrixify
    const updatedProps = {
      ...props,
      form_data: {
        ...props.form_data,
        viz_type: 'line',
        matrixify_enable: true,
        matrixify_mode_columns: 'metrics',
      },
    };

    rerender(<ControlPanelsContainer {...updatedProps} />);

    // Matrixify tab should now be active
    await waitFor(() => {
      const matrixifyTab = screen.getByRole('tab', { name: /matrixify/i });
      expect(matrixifyTab).toBeInTheDocument();
      expect(matrixifyTab).toHaveAttribute('aria-selected', 'true');
    });

    // Data tab should no longer be active
    expect(screen.getByRole('tab', { name: /data/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // Clean up
    getChartControlPanelRegistry().remove('line');
  });

  test('should stash control value when visibility is false and disableStash is not set', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Query'),
          expanded: true,
          controlSetRows: [
            [
              {
                name: 'x_axis_time_format',
                config: {
                  type: 'SelectControl',
                  label: t('Time Format'),
                  default: 'smart_date',
                  choices: [['smart_date', 'Adaptive Formatting']],
                  visibility: () => false,
                },
              },
            ],
          ],
        },
      ],
    });

    const props = getDefaultProps();
    props.form_data = {
      ...props.form_data,
      x_axis_time_format: 'smart_date',
    };

    const { getByTestId } = render(
      <>
        <ControlPanelsContainer {...props} />
        <FormDataMock />
      </>,
      {
        useRedux: true,
        initialState: {
          explore: {
            form_data: {
              ...defaultState.form_data,
              x_axis_time_format: 'smart_date',
            },
          },
        },
      },
    );

    await waitFor(() => {
      expect(getByTestId('mock-formdata')).not.toHaveTextContent(
        'x_axis_time_format',
      );
    });
  });

  test('should preserve control value when visibility is false and disableStash is true', async () => {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Query'),
          expanded: true,
          controlSetRows: [
            [
              {
                name: 'x_axis_time_format',
                config: {
                  type: 'SelectControl',
                  label: t('Time Format'),
                  default: 'smart_date',
                  choices: [['smart_date', 'Adaptive Formatting']],
                  visibility: () => false,
                  disableStash: true,
                },
              },
            ],
          ],
        },
      ],
    });

    const props = getDefaultProps();
    props.form_data = {
      ...props.form_data,
      x_axis_time_format: 'smart_date',
    };

    const { getByTestId } = render(
      <>
        <ControlPanelsContainer {...props} />
        <FormDataMock />
      </>,
      {
        useRedux: true,
        initialState: {
          explore: {
            form_data: {
              ...defaultState.form_data,
              x_axis_time_format: 'smart_date',
            },
          },
        },
      },
    );

    await waitFor(() => {
      expect(getByTestId('mock-formdata')).toHaveTextContent(
        'x_axis_time_format',
      );
    });
  });

  test('should not show Matrixify tab for table chart types', async () => {
    // Enable Matrixify feature flag
    mockIsFeatureEnabled.mockImplementation(
      (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.Matrixify,
    );

    // All table-type charts that don't support matrixify
    const tableVizTypes = [
      'table',
      'ag-grid-table',
      'pivot_table_v2',
      'time_table',
      'time_pivot',
    ];

    for (const vizType of tableVizTypes) {
      const props = getDefaultProps();
      props.form_data = {
        ...props.form_data,
        viz_type: vizType,
      };

      render(<ControlPanelsContainer {...props} />, {
        useRedux: true,
      });

      // Wait for tabs to be rendered
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /data/i })).toBeInTheDocument();
      });

      // Check that Matrixify tab does not exist for table chart types
      expect(
        screen.queryByRole('tab', { name: /matrixify/i }),
      ).not.toBeInTheDocument();
    }
  });

  test('should show Matrixify tab for supported chart types', async () => {
    // Enable Matrixify feature flag
    mockIsFeatureEnabled.mockImplementation(
      (featureFlag: FeatureFlag) => featureFlag === FeatureFlag.Matrixify,
    );

    // Register control panels for non-table chart types
    const simpleConfig = { controlPanelSections: [] };
    getChartControlPanelRegistry().registerValue('line', simpleConfig);
    getChartControlPanelRegistry().registerValue('bar', simpleConfig);
    getChartControlPanelRegistry().registerValue('pie', simpleConfig);

    // Non-table chart types that support matrixify
    const supportedVizTypes = ['line', 'bar', 'pie'];

    for (const vizType of supportedVizTypes) {
      const props = getDefaultProps();
      props.form_data = {
        ...props.form_data,
        viz_type: vizType,
      };

      const { unmount } = render(<ControlPanelsContainer {...props} />, {
        useRedux: true,
      });

      // Wait for Matrixify tab to be rendered
      await waitFor(() => {
        expect(
          screen.getByRole('tab', { name: /matrixify/i }),
        ).toBeInTheDocument();
      });

      // Also verify Data tab exists
      expect(screen.getByRole('tab', { name: /data/i })).toBeInTheDocument();

      // Clean up this render before the next iteration
      unmount();
    }

    // Clean up registered chart types
    getChartControlPanelRegistry().remove('line');
    getChartControlPanelRegistry().remove('bar');
    getChartControlPanelRegistry().remove('pie');
  });

  // The partition-pruning glyph on the standalone Time Range control is
  // recomputed here, at render, rather than by the explore reducer: a control
  // that listed itself in `validationDependencies` was rebuilt by the reducer
  // from its own superseded value, which dropped every Time Range change on the
  // charts that still carry this control. `shouldMapStateToProps` gives the
  // glyph the freshness it needs without the reducer ever touching the value.
  const PARTITION_FILTER_MAPPING = {
    partition_column: 'dt_epoch',
    mapped_column: 'event_time',
    active: true,
    is_monotonic: true,
    mirrorable_operators: ['<', '<=', '==', '>', '>=', 'IN', 'TEMPORAL_RANGE'],
  };

  const mirroredDatasource: Dataset = {
    id: 1,
    type: DatasourceType.Table,
    datasource_name: 'mirrored',
    description: null,
    column_formats: {},
    verbose_map: {},
    main_dttm_col: 'event_time',
    always_filter_main_dttm: false,
    columns: [{ column_name: 'event_time', is_dttm: true }],
    metrics: [],
    partition_filter_mapping: PARTITION_FILTER_MAPPING,
  };

  /**
   * Props shaped the way SET_FIELD_VALUE leaves the store: `form_data` and the
   * control's `value` carry the new range, while the control state still holds
   * the `partitionMapping` computed for `initialTimeRange`. Recomputing that
   * stale prop is the container's job, so building the control fresh for each
   * range would test nothing.
   */
  function mirroredTimeRangeProps(
    timeRange: string,
    initialTimeRange = timeRange,
  ) {
    const controlPanelState = {
      controls: {},
      form_data: {
        datasource: '1__table',
        viz_type: 'table',
        granularity_sqla: 'event_time',
        time_range: initialTimeRange,
      },
      datasource: mirroredDatasource,
    };
    const controlState = getControlStateFromControlConfig(
      sharedControls.time_range as Parameters<
        typeof getControlStateFromControlConfig
      >[0],
      controlPanelState as Parameters<
        typeof getControlStateFromControlConfig
      >[1],
      initialTimeRange,
    )!;
    const formData = {
      datasource: '1__table',
      viz_type: 'table',
      granularity_sqla: 'event_time',
      time_range: timeRange,
    };

    return {
      ...getDefaultProps(),
      controls: {
        time_range: { ...controlState, value: timeRange },
      } as unknown as ControlPanelsContainerProps['controls'],
      form_data: formData,
      exploreState: { form_data: formData, datasource: mirroredDatasource },
    } as unknown as ControlPanelsContainerProps;
  }

  function registerTimeRangeOnlyPanel() {
    getChartControlPanelRegistry().remove('table');
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('Time'),
          expanded: true,
          controlSetRows: [['time_range']],
        },
      ],
    });
  }

  test('the partition glyph shows on a time range that is mirrored', async () => {
    registerTimeRangeOnlyPanel();

    render(
      <ControlPanelsContainer {...mirroredTimeRangeProps('Last week')} />,
      {
        useRedux: true,
      },
    );

    expect(
      await screen.findByTestId('partition-pruning-indicator'),
    ).toBeInTheDocument();
  });

  test('the partition glyph drops when the time range becomes "No filter"', async () => {
    registerTimeRangeOnlyPanel();

    const { rerender } = render(
      <ControlPanelsContainer {...mirroredTimeRangeProps('Last week')} />,
      { useRedux: true },
    );
    expect(
      await screen.findByTestId('partition-pruning-indicator'),
    ).toBeInTheDocument();

    rerender(
      <ControlPanelsContainer
        {...mirroredTimeRangeProps(NO_TIME_RANGE, 'Last week')}
      />,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('partition-pruning-indicator'),
      ).not.toBeInTheDocument();
    });
  });
});
