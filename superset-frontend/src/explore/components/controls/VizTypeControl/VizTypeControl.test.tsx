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
import { Preset, VizType } from '@superset-ui/core';
import {
  render,
  cleanup,
  screen,
  userEvent,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { DynamicPluginProvider } from 'src/components';
import { testWithId } from 'src/utils/testUtils';
import TimeTableChartPlugin from 'src/visualizations/TimeTable';
import {
  BigNumberTotalChartPlugin,
  EchartsAreaChartPlugin,
  EchartsMixedTimeseriesChartPlugin,
  EchartsPieChartPlugin,
  EchartsTimeseriesBarChartPlugin,
  EchartsTimeseriesChartPlugin,
  EchartsTimeseriesLineChartPlugin,
} from '../../../../../plugins/plugin-chart-echarts/src';
import TableChartPlugin from '../../../../../plugins/plugin-chart-table/src';
import VizTypeControl, { VIZ_TYPE_CONTROL_TEST_ID } from './index';

// Mock scrollIntoView to avoid errors in test environment
jest.mock('scroll-into-view-if-needed', () => jest.fn());

jest.useFakeTimers();

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TableChartPlugin().configure({ key: VizType.Table }),
        new BigNumberTotalChartPlugin().configure({
          key: VizType.BigNumberTotal,
        }),
        new EchartsTimeseriesLineChartPlugin().configure({
          key: VizType.Line,
        }),
        new EchartsAreaChartPlugin().configure({
          key: VizType.Area,
        }),
        new EchartsTimeseriesBarChartPlugin().configure({
          key: VizType.Bar,
        }),
        new EchartsPieChartPlugin().configure({ key: VizType.Pie }),
        new EchartsTimeseriesChartPlugin().configure({
          key: VizType.Timeseries,
        }),
        new TimeTableChartPlugin().configure({ key: VizType.TimeTable }),
        new EchartsMixedTimeseriesChartPlugin().configure({
          key: VizType.MixedTimeseries,
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
      value: VizType.Line,
      isModalOpenInit: false,
    };
    await waitForRenderWrapper(props);
    expect(screen.getByLabelText('table')).toBeVisible();
    expect(screen.getByLabelText('big-number_chart_tile')).toBeVisible();
    expect(screen.getByLabelText('pie-chart')).toBeVisible();
    expect(screen.getByLabelText('bar-chart')).toBeVisible();
    expect(screen.getByLabelText('area-chart')).toBeVisible();
    expect(screen.queryByLabelText('monitor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('check-square')).not.toBeInTheDocument();

    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Line Chart'),
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
      within(screen.getByTestId('fast-viz-switcher')).getByText('Bar Chart'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Area Chart'),
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
      within(screen.getByTestId('fast-viz-switcher')).getByText('Line Chart'),
    ).toBeVisible();
  });

  it('Render viz tiles when non-featured is rendered', async () => {
    const props = {
      ...defaultProps,
      value: VizType.Sankey,
      isModalOpenInit: false,
    };
    const state = {
      charts: {
        1: {
          latestQueryFormData: {
            viz_type: VizType.Sankey,
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
      within(screen.getByTestId('fast-viz-switcher')).getByText('Line Chart'),
    ).toBeVisible();
  });

  it('Change viz type on click', async () => {
    const props = {
      ...defaultProps,
      value: VizType.Line,
      isModalOpenInit: false,
    };
    await waitForRenderWrapper(props);
    userEvent.click(
      within(screen.getByTestId('fast-viz-switcher')).getByText('Line Chart'),
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
    ).toBeInTheDocument();
  });

  it('Search visualization type', async () => {
    await waitForRenderWrapper();

    const visualizations = screen.getByTestId(getTestId('viz-row'));

    userEvent.click(screen.getByRole('tab', { name: 'All charts' }));

    expect(
      await within(visualizations).findByText('Line Chart'),
    ).toBeInTheDocument();

    // search
    userEvent.type(
      screen.getByTestId(getTestId('search-input')),
      'time series',
    );
    expect(
      await within(visualizations).findByText('Time-series Table'),
    ).toBeInTheDocument();
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
    userEvent.click(screen.getByRole('tab', { name: 'All charts' }));
    const visualizations = screen.getByTestId(getTestId('viz-row'));
    userEvent.click(within(visualizations).getByText('Bar Chart'));

    expect(defaultProps.onChange).not.toHaveBeenCalled();
    userEvent.dblClick(within(visualizations).getByText('Line Chart'));

    expect(defaultProps.onChange).toHaveBeenCalledWith(VizType.Line);
  });

  it('Search input is focused when modal opens', async () => {
    // Mock the focus method to track if it was called
    const focusSpy = jest.fn();
    const originalFocus = HTMLInputElement.prototype.focus;
    HTMLInputElement.prototype.focus = focusSpy;

    await waitForRenderWrapper();

    const searchInput = screen.getByTestId(getTestId('search-input'));

    // Verify that focus() was called on the search input
    expect(focusSpy).toHaveBeenCalled();
    expect(searchInput).toBeInTheDocument();

    // Restore the original focus method
    HTMLInputElement.prototype.focus = originalFocus;
  });
});
