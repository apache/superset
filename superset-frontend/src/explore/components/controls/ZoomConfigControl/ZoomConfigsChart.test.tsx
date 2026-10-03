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

// Pixel space is an invertible transform of axis space so a drag handler that
// forwards the wrong coordinate, or skips the conversion, yields a different
// size than the one dragged to.
const PIXEL_OFFSET = 10;
const PIXEL_SCALE = 2;
const toPixel = (value: number) => value * PIXEL_SCALE + PIXEL_OFFSET;
const fromPixel = (pixel: number) => (pixel - PIXEL_OFFSET) / PIXEL_SCALE;

const setup = () => {
  const chart = {
    setOption: jest.fn(),
    convertToPixel: jest.fn((_finder: string, [x, y]: number[]) => [
      toPixel(x),
      y * 3,
    ]),
    convertFromPixel: jest.fn((_finder: string, [x, y]: number[]) => [
      fromPixel(x),
      y / 3,
    ]),
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

test('reports the dragged width through onChange', () => {
  const chart = setup();
  const onChange = jest.fn();
  render(
    <ZoomConfigsChart name="zoomlevels" value={value} onChange={onChange} />,
  );
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  // Dragging the first width handle to pixel 90 lands on size 40.
  graphic[0].ondrag.call({ x: toPixel(40), y: 0 });
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(chart.convertFromPixel).toHaveBeenCalledWith('grid', [toPixel(40), 0]);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0].values).toEqual({
    0: { width: 40, height: 20 },
    1: { width: 11, height: 21 },
  });
  expect(onChange.mock.calls[0][0].type).toBe('FIXED');
});

test('reports the dragged height through onChange', () => {
  const chart = setup();
  const onChange = jest.fn();
  render(
    <ZoomConfigsChart name="zoomlevels" value={value} onChange={onChange} />,
  );
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  graphic[3].ondrag.call({ x: toPixel(60), y: 0 });
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(onChange.mock.calls[0][0].values[1]).toEqual({
    width: 11,
    height: 60,
  });
});

test('places each drag handle at the pixel position of its bar end', () => {
  const chart = setup();
  render(<ZoomConfigsChart name="zoomlevels" value={value} />);
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  // Handles are ordered width then height per zoom level.
  expect(graphic.map((handle: { x: number }) => handle.x)).toEqual([
    toPixel(10),
    toPixel(20),
    toPixel(11),
    toPixel(21),
  ]);
});

test('clamps a width dragged left of the axis to zero', () => {
  const chart = setup();
  const onChange = jest.fn();
  render(
    <ZoomConfigsChart name="zoomlevels" value={value} onChange={onChange} />,
  );
  const [{ graphic }] = chart.setOption.mock.calls.filter(
    ([option]) => option.graphic,
  )[0];

  graphic[0].ondrag.call({ x: 0, y: 0 });
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(onChange.mock.calls[0][0].values[0].width).toBe(0);
});
