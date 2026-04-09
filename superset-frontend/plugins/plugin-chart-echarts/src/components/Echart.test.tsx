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
import type { EChartsCoreOption } from 'echarts/core';
import { render, waitFor } from '../../../../spec/helpers/testing-library';
import Echart from './Echart';

jest.mock('echarts/core', () => ({
  __esModule: true,
  __mockFns: {
    chart: {
      dispose: jest.fn(),
      dispatchAction: jest.fn(),
      getZr: jest.fn(() => ({
        off: jest.fn(),
        on: jest.fn(),
      })),
      off: jest.fn(),
      on: jest.fn(),
      resize: jest.fn(),
      setOption: jest.fn(),
    },
    init: jest.fn(),
    registerLocale: jest.fn(),
    use: jest.fn(),
  },
  init: (...args: unknown[]) => {
    const { __mockFns } = jest.requireMock('echarts/core') as {
      __mockFns: {
        chart: object;
        init: jest.Mock;
      };
    };
    __mockFns.init(...args);
    return __mockFns.chart;
  },
  registerLocale: (...args: unknown[]) => {
    const { __mockFns } = jest.requireMock('echarts/core') as {
      __mockFns: { registerLocale: jest.Mock };
    };
    return __mockFns.registerLocale(...args);
  },
  use: (...args: unknown[]) => {
    const { __mockFns } = jest.requireMock('echarts/core') as {
      __mockFns: { use: jest.Mock };
    };
    return __mockFns.use(...args);
  },
}));

const {
  __mockFns: { chart: mockChart },
} = jest.requireMock('echarts/core') as {
  __mockFns: {
    chart: {
      dispatchAction: jest.Mock;
      dispose: jest.Mock;
      getZr: jest.Mock;
      off: jest.Mock;
      on: jest.Mock;
      resize: jest.Mock;
      setOption: jest.Mock;
    };
  };
};

const mockDispatchAction = mockChart.dispatchAction;
const mockSetOption = mockChart.setOption;

const baseOptions: EChartsCoreOption = {
  series: [],
  tooltip: {
    appendToBody: true,
    show: true,
  },
  xAxis: {},
  yAxis: {},
};

const renderEchart = () =>
  render(
    <Echart echartOptions={baseOptions} height={320} refs={{}} width={640} />,
    {
      initialState: {
        common: { locale: 'en' },
        dashboardState: { isRefreshing: false },
      },
      useRedux: true,
    },
  );

const mockFullscreenElement = (getElement: () => Element | null) => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: getElement,
  });
};

afterEach(() => {
  jest.clearAllMocks();
  Reflect.deleteProperty(document, 'fullscreenElement');
});

test('syncs tooltip appendToBody after entering fullscreen', async () => {
  let fullscreenElement: Element | null = null;
  mockFullscreenElement(() => fullscreenElement);

  renderEchart();

  await waitFor(() => {
    expect(mockSetOption).toHaveBeenCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({
          appendToBody: true,
          show: true,
        }),
      }),
      expect.anything(),
    );
  });

  fullscreenElement = document.createElement('div');
  document.dispatchEvent(new Event('fullscreenchange'));

  await waitFor(() => {
    expect(mockDispatchAction).toHaveBeenCalledWith({ type: 'hideTip' });
    expect(mockSetOption).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({
          appendToBody: false,
          show: true,
        }),
      }),
      expect.anything(),
    );
  });
});

test('syncs tooltip appendToBody after exiting fullscreen', async () => {
  const fullscreenTarget = document.createElement('div');
  let fullscreenElement: Element | null = fullscreenTarget;
  mockFullscreenElement(() => fullscreenElement);

  renderEchart();

  await waitFor(() => {
    expect(mockSetOption).toHaveBeenCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({
          appendToBody: false,
          show: true,
        }),
      }),
      expect.anything(),
    );
  });

  fullscreenElement = null;
  document.dispatchEvent(new Event('fullscreenchange'));

  await waitFor(() => {
    expect(mockDispatchAction).toHaveBeenCalledWith({ type: 'hideTip' });
    expect(mockSetOption).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tooltip: expect.objectContaining({
          appendToBody: true,
          show: true,
        }),
      }),
      expect.anything(),
    );
  });
});
