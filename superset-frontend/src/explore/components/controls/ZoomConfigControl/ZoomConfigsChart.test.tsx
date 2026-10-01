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
import { act, render } from 'spec/helpers/testing-library';
import { init } from 'echarts';
import ZoomConfigsChart from './ZoomConfigsChart';
import { ZoomConfigs } from './types';

// echarts needs a real canvas/layout engine; replace only chart creation and
// keep the rest of the module (e.g. util) intact.
jest.mock('echarts', () => ({
  ...jest.requireActual('echarts'),
  init: jest.fn(),
}));

const value: ZoomConfigs = {
  type: 'FIXED',
  configs: { zoom: 2, width: 10, height: 20 },
  values: {
    0: { width: 10, height: 20 },
    1: { width: 11, height: 21 },
  },
};

const setup = () => {
  const chart = {
    setOption: jest.fn(),
    convertToPixel: jest.fn(() => [50, 60]),
    convertFromPixel: jest.fn(() => [77.4, 1]),
  };
  (init as jest.Mock).mockReturnValue(chart);
  return chart;
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('does not create a chart without a value', () => {
  setup();
  render(<ZoomConfigsChart name="zoomlevels" value={undefined} />);
  expect(init).not.toHaveBeenCalled();
});

test('creates a chart whose dataset mirrors the zoom level sizes', () => {
  const chart = setup();
  render(<ZoomConfigsChart name="zoomlevels" value={value} />);
  expect(init).toHaveBeenCalledTimes(1);
  const option = chart.setOption.mock.calls[0][0];
  expect(option.dataset.source).toEqual([
    [10, 20, 0],
    [11, 21, 1],
  ]);
});

test('adds a width and a height drag handle for every zoom level', () => {
  const chart = setup();
  render(<ZoomConfigsChart name="zoomlevels" value={value} />);
  const graphicCall = chart.setOption.mock.calls.find(
    ([option]) => option.graphic,
  );
  expect(graphicCall?.[0].graphic).toHaveLength(4);
});

test('reports new sizes through onChange after dragging a width handle', () => {
  const chart = setup();
  const onChange = jest.fn();
  render(
    <ZoomConfigsChart name="zoomlevels" value={value} onChange={onChange} />,
  );
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  graphic[0].ondrag.call({ x: 77, y: 0 });
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].values).toEqual({
    0: { width: 77, height: 20 },
    1: { width: 11, height: 21 },
  });
  expect(onChange.mock.calls[0][0].type).toBe('FIXED');
});

test('reports new sizes through onChange after dragging a height handle', () => {
  const chart = setup();
  const onChange = jest.fn();
  render(
    <ZoomConfigsChart name="zoomlevels" value={value} onChange={onChange} />,
  );
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  graphic[3].ondrag.call({ x: 77, y: 0 });
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(onChange.mock.calls[0][0].values[1]).toEqual({
    width: 11,
    height: 77,
  });
});
