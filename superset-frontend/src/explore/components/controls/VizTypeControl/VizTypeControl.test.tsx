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
import { render, cleanup, screen, waitFor } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import {
  getMockStore,
  mockStore,
  stateWithoutNativeFilters,
} from 'spec/fixtures/mockStore';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { DynamicPluginProvider } from 'src/components/DynamicPlugins';
import { testWithId } from 'src/utils/testUtils';
import {
  EchartsMixedTimeseriesChartPlugin,
  EchartsTimeseriesChartPlugin,
} from '@superset-ui/plugin-chart-echarts/lib';
import { LineChartPlugin } from '@superset-ui/preset-chart-xy/lib';
import TimeTableChartPlugin from '../../../../visualizations/TimeTable/TimeTableChartPlugin';
import VizTypeControl, { VIZ_TYPE_CONTROL_TEST_ID } from './index';

jest.useFakeTimers();

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new LineChartPlugin().configure({ key: 'line' }),
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
  const newVizTypeControlProps = {
    description: '',
    label: '',
    name: '',
    value: '',
    labelType: 'primary',
    onChange: jest.fn(),
    isModalOpenInit: true,
  } as const;

  const renderWrapper = (
    props = newVizTypeControlProps,
    state: object = stateWithoutNativeFilters,
  ) => {
    render(
      <Provider
        store={state ? getMockStore(stateWithoutNativeFilters) : mockStore}
      >
        <DynamicPluginProvider>
          <VizTypeControl {...props} />
        </DynamicPluginProvider>
      </Provider>,
    );
  };

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('Search visualization type', async () => {
    renderWrapper();

    const visualizations = screen.getByTestId(getTestId('viz-row'));

    userEvent.click(screen.getByRole('button', { name: 'ballot All charts' }));

    await waitFor(() => {
      expect(visualizations).toHaveTextContent(/Time-series Table/);
    });

    // search
    userEvent.type(
      screen.getByTestId(getTestId('search-input')),
      'time series',
    );
    await waitFor(() => {
      expect(visualizations).toHaveTextContent(/Time-series Table/);
      expect(visualizations).toHaveTextContent(/Time-series Chart/);
      expect(visualizations).toHaveTextContent(/Mixed Time-Series/);
      expect(visualizations).not.toHaveTextContent(/Line Chart/);
    });
  });
});
