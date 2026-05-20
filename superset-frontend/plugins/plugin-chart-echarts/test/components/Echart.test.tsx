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
import { render, waitFor } from 'spec/helpers/testing-library';

const setOption = jest.fn();
const on = jest.fn();
const off = jest.fn();
const resize = jest.fn();
const dispose = jest.fn();
const dispatchAction = jest.fn();
const getOption = jest.fn();

const mockInstance = {
  setOption,
  on,
  off,
  resize,
  dispose,
  dispatchAction,
  getOption,
  getZr: () => ({ on: jest.fn(), off: jest.fn() }),
};

jest.mock('echarts/core', () => ({
  __esModule: true,
  use: jest.fn(),
  init: jest.fn(() => mockInstance),
  registerLocale: jest.fn(),
}));
jest.mock('echarts/charts', () => ({}));
jest.mock('echarts/renderers', () => ({}));
jest.mock('echarts/components', () => ({}));
jest.mock('echarts/features', () => ({}));

// eslint-disable-next-line import/first
import Echart from '../../src/components/Echart';

const renderEchart = (echartOptions: EChartsCoreOption) => {
  const refs = { divRef: undefined };
  return render(
    <Echart
      width={400}
      height={300}
      echartOptions={echartOptions}
      refs={refs}
    />,
    { useRedux: true, useTheme: true },
  );
};

beforeEach(() => {
  setOption.mockClear();
  on.mockClear();
  off.mockClear();
  resize.mockClear();
  dispatchAction.mockClear();
  getOption.mockReset();
});

test('preserves user dataZoom range across setOption(notMerge)', async () => {
  // After the user has zoomed, ECharts reports the current dataZoom range
  // via getOption().dataZoom. We expect Echart to capture this before
  // setOption replaces the option payload, then restore it via dispatchAction.
  getOption.mockReturnValue({
    dataZoom: [{ start: 12, end: 48 }],
  });

  const { rerender } = renderEchart({ xAxis: {}, series: [] });

  // Trigger another setOption call by changing the echartOptions reference
  rerender(
    <Echart
      width={400}
      height={300}
      echartOptions={{ xAxis: {}, series: [{ type: 'line' }] }}
      refs={{ divRef: undefined }}
    />,
  );

  await waitFor(() =>
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dataZoom',
        batch: [
          expect.objectContaining({ dataZoomIndex: 0, start: 12, end: 48 }),
        ],
      }),
    ),
  );
});

test('does not restore when no prior zoom range exists', async () => {
  // Fresh chart with no engaged zoom: dataZoom config has no start/end.
  getOption.mockReturnValue({
    dataZoom: [{ type: 'slider', show: true }],
  });

  const { rerender } = renderEchart({ xAxis: {}, series: [] });
  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(1));

  rerender(
    <Echart
      width={400}
      height={300}
      echartOptions={{ xAxis: {}, series: [{ type: 'line' }] }}
      refs={{ divRef: undefined }}
    />,
  );

  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(2));
  const dataZoomCalls = dispatchAction.mock.calls.filter(
    ([action]) => action?.type === 'dataZoom',
  );
  expect(dataZoomCalls).toHaveLength(0);
});

test('does not restore when prior zoom is at default full range', async () => {
  // ECharts populates start:0/end:100 on slider dataZoom by default, so
  // every untouched timeseries would otherwise dispatch a redundant action
  // on each re-render. Skip the dispatch when the range is just the default.
  getOption.mockReturnValue({
    dataZoom: [{ type: 'slider', show: true, start: 0, end: 100 }],
  });

  const { rerender } = renderEchart({ xAxis: {}, series: [] });
  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(1));

  rerender(
    <Echart
      width={400}
      height={300}
      echartOptions={{ xAxis: {}, series: [{ type: 'line' }] }}
      refs={{ divRef: undefined }}
    />,
  );

  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(2));
  const dataZoomCalls = dispatchAction.mock.calls.filter(
    ([action]) => action?.type === 'dataZoom',
  );
  expect(dataZoomCalls).toHaveLength(0);
});

test('does not restore when the new option reshapes dataZoom', async () => {
  // 1st render starts with no engaged zoom; 2nd render captures an engaged
  // range but the post-setOption dataZoom has a different count, so
  // index-based restore could write to the wrong component. Skip in that case.
  getOption
    // 1st render: previousZoom + newZoom (no engaged values, nothing to dispatch)
    .mockReturnValueOnce({ dataZoom: [{ type: 'slider' }] })
    .mockReturnValueOnce({ dataZoom: [{ type: 'slider' }] })
    // 2nd render: previousZoom has user range, but newZoom has 2 entries
    .mockReturnValueOnce({ dataZoom: [{ start: 12, end: 48 }] })
    .mockReturnValueOnce({
      dataZoom: [{ start: 12, end: 48 }, { type: 'inside' }],
    });

  const { rerender } = renderEchart({ xAxis: {}, series: [] });
  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(1));

  rerender(
    <Echart
      width={400}
      height={300}
      echartOptions={{ xAxis: {}, series: [{ type: 'line' }] }}
      refs={{ divRef: undefined }}
    />,
  );

  await waitFor(() => expect(setOption).toHaveBeenCalledTimes(2));
  const dataZoomCalls = dispatchAction.mock.calls.filter(
    ([action]) => action?.type === 'dataZoom',
  );
  expect(dataZoomCalls).toHaveLength(0);
});
