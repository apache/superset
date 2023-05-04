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
import { Preset } from '@superset-ui/core';
import {
  render,
  cleanup,
  screen,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import { testWithId } from 'src/utils/testUtils';
import {
  BigNumberTotalChartPlugin,
  EchartsAreaChartPlugin,
  EchartsMixedTimeseriesChartPlugin,
  EchartsPieChartPlugin,
  EchartsTimeseriesBarChartPlugin,
  EchartsTimeseriesChartPlugin,
  EchartsTimeseriesLineChartPlugin,
} from '@superset-ui/plugin-chart-echarts';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import TimeTableChartPlugin from 'src/visualizations/TimeTable';
import VizTypeControl, { VIZ_TYPE_CONTROL_TEST_ID } from './index';

jest.useFakeTimers();

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TableChartPlugin().configure({ key: 'table' }),
        new BigNumberTotalChartPlugin().configure({ key: 'big_number_total' }),
        new EchartsTimeseriesLineChartPlugin().configure({
          key: 'echarts_timeseries_line',
        }),
        new EchartsAreaChartPlugin().configure({
          key: 'echarts_area',
        }),
        new EchartsTimeseriesBarChartPlugin().configure({
          key: 'echarts_timeseries_bar',
        }),
        new EchartsPieChartPlugin().configure({ key: 'pie' }),
        new EchartsTimeseriesChartPlugin().configure({
          key: 'echarts_timeseries',
        }),
        new TimeTableChartPlugin().configure({ key: 'time_table' }),
        new EchartsMixedTimeseriesChartPlugin().configure({
          key: 'mixed_timeseries',
        }),
      ],
    });
  }
}

const getTestId = testWithId<string>(VIZ_TYPE_CONTROL_TEST_ID, true);

/**
 * AntD and/or the Icon component seems to be doing some kind of async changes,
 * so even though the test passes, there is a warning an update to Icon was not
 * wrapped in act(). This sufficiently act-ifies whatever side effects are going
 * on and prevents those warnings.
 */

describe('VizTypeControl', () => {
  new MainPreset().register();
  const defaultProps = {
    description: '',
    label: '',
    name: '',
    value: '',
    labelType: 'primary',
    onChange: jest.fn(),
    isModalOpenInit: true,
  };

  const waitForRenderWrapper = (
    props: typeof defaultProps = defaultProps,
    state: object = stateWithoutNativeFilters,
  ) =>
    waitFor(() => {
      render(
        <DynamicPluginProvider>
          <VizTypeControl {...props} />
        </DynamicPluginProvider>,
        { useRedux: true, initialState: state },
      );
    });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('Fast viz switcher tiles render', async () => {
    const props = {
      ...defaultProps,
      value: 'echarts_timeseries_line',
      isModalOpenInit: false,
    };
    await waitForRenderWrapper(props);
    expect(screen.getByLabelText('table-chart-tile')).toBeVisible();
    expect(screen.getByLabelText('big-number-chart-tile')).toBeVisible();
    expect(screen.getByLabelText('pie-chart-tile')).toBeVisible();
    expect(screen.getByLabelText('bar-chart-tile')).toBeVisible();
    expect(screen.getByLabelText('area-chart-tile')).toBeVisible();
    expect(screen.queryByLabelText('monitor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('check-square')).not.toBeInTheDocument();

    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Line Chart',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Table'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Big Number'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Pie Chart'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Bar Chart',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Area Chart',
      ),
    ).toBeInTheDocument();
  });

  it('Render viz tiles when non-featured chart is selected', async () => {
    const props = {
      ...defaultProps,
      value: 'line',
      isModalOpenInit: false,
    };
    await waitForRenderWrapper(props);

    expect(screen.getByLabelText('monitor')).toBeVisible();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Line Chart',
      ),
    ).toBeVisible();
  });

  it('Render viz tiles when non-featured is rendered', async () => {
    const props = {
      ...defaultProps,
      value: 'line',
      isModalOpenInit: false,
    };
    const state = {
      charts: {
        1: {
          latestQueryFormData: {
            viz_type: 'line',
          },
        },
      },
      explore: {
        slice: {
          slice_id: 1,
        },
      },
    };
    await waitForRenderWrapper(props, state);
    expect(screen.getByLabelText('check-square')).toBeVisible();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Line Chart',
      ),
    ).toBeVisible();
  });

  it('Change viz type on click', async () => {
    const props = {
      ...defaultProps,
      value: 'echarts_timeseries_line',
      isModalOpenInit: false,
    };
    await waitForRenderWrapper(props);
    userEvent.click(
      within(screen.getByTestId('fast-viz-switcher')).getByText(
        'Time-series Line Chart',
      ),
    );
    expect(props.onChange).not.toHaveBeenCalled();
    userEvent.click(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Table'),
    );
    expect(props.onChange).toHaveBeenCalledWith('table');
  });

  it('Open viz gallery modal on "View all charts" click', async () => {
    await waitForRenderWrapper({ ...defaultProps, isModalOpenInit: false });
    expect(
      screen.queryByText('Select a visualization type'),
    ).not.toBeInTheDocument();
    userEvent.click(screen.getByText('View all charts'));
    expect(
      await screen.findByText('Select a visualization type'),
    ).toBeVisible();
  });

  it('Search visualization type', async () => {
    await waitForRenderWrapper();

    const visualizations = screen.getByTestId(getTestId('viz-row'));

    userEvent.click(screen.getByRole('button', { name: 'ballot All charts' }));

    expect(
      await within(visualizations).findByText('Time-series Line Chart'),
    ).toBeVisible();

    // search
    userEvent.type(
      screen.getByTestId(getTestId('search-input')),
      'time series',
    );
    expect(
      await within(visualizations).findByText('Time-series Table'),
    ).toBeVisible();
    expect(within(visualizations).getByText('Time-series Chart')).toBeVisible();
    expect(within(visualizations).getByText('Mixed Time-Series')).toBeVisible();
    expect(
      within(visualizations).getByText('Time-series Area Chart'),
    ).toBeVisible();
    expect(
      within(visualizations).getByText('Time-series Line Chart'),
    ).toBeVisible();
    expect(
      within(visualizations).getByText('Time-series Bar Chart'),
    ).toBeVisible();
    expect(within(visualizations).queryByText('Table')).not.toBeInTheDocument();
    expect(
      within(visualizations).queryByText('Big Number'),
    ).not.toBeInTheDocument();
    expect(
      within(visualizations).queryByText('Pie Chart'),
    ).not.toBeInTheDocument();
  });

  it('Submit on viz type double-click', async () => {
    await waitForRenderWrapper();
    userEvent.click(screen.getByRole('button', { name: 'ballot All charts' }));
    const visualizations = screen.getByTestId(getTestId('viz-row'));
    userEvent.click(within(visualizations).getByText('Time-series Bar Chart'));

    expect(defaultProps.onChange).not.toBeCalled();
    userEvent.dblClick(
      within(visualizations).getByText('Time-series Line Chart'),
    );

    expect(defaultProps.onChange).toHaveBeenCalledWith(
      'echarts_timeseries_line',
    );
  });
});
