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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import ZoomConfigControl from './ZoomConfigControl';
import { ZoomConfigs } from './types';
import { computeConfigValues } from './zoomUtil';

// echarts needs a real canvas/layout engine; replace only chart creation and
// keep the rest of the module (e.g. util) intact.
jest.mock('echarts', () => ({
  ...jest.requireActual('echarts'),
  init: jest.fn(() => ({
    setOption: jest.fn(),
    convertToPixel: jest.fn(() => [0, 0]),
    convertFromPixel: jest.fn(() => [0, 0]),
  })),
}));

const makeValue = (type: ZoomConfigs['type'] = 'FIXED'): ZoomConfigs => {
  const configs = {
    zoom: 5,
    width: 40,
    height: 20,
    slope: 2,
    exponent: 1.4,
  };
  const base = { type, configs: { ...configs }, values: {} } as ZoomConfigs;
  return { ...base, values: computeConfigValues(base) } as ZoomConfigs;
};

const setup = (value?: ZoomConfigs) => {
  const onChange = jest.fn();
  render(
    <ZoomConfigControl
      name="zoom_configs"
      label="Zoom sizes"
      value={value}
      onChange={onChange}
    />,
  );
  return { onChange };
};

test('renders the label, shape options, sliders and current zoom', () => {
  setup(makeValue());
  expect(screen.getByText('Zoom sizes')).toBeInTheDocument();
  ['FIXED', 'LINEAR', 'EXP'].forEach(shape =>
    expect(screen.getByText(shape)).toBeInTheDocument(),
  );
  expect(screen.getAllByRole('slider')).toHaveLength(4);
  expect(screen.getByText(/Current Zoom/)).toHaveTextContent('Current Zoom: 5');
});

test('initialises the sliders from the configured sizes', () => {
  setup(makeValue());
  const [width, height, slope, exponent] = screen.getAllByRole('slider');
  expect(width).toHaveAttribute('aria-valuenow', '40');
  expect(height).toHaveAttribute('aria-valuenow', '20');
  expect(slope).toHaveAttribute('aria-valuenow', '2');
  expect(exponent).toHaveAttribute('aria-valuenow', '1.4');
});

test('switching the shape emits a config of that type built from the base values', () => {
  const { onChange } = setup(makeValue('FIXED'));
  fireEvent.click(screen.getByRole('radio', { name: 'LINEAR' }));
  const emitted = onChange.mock.lastCall?.[0];
  expect(emitted.type).toBe('LINEAR');
  expect(emitted.configs).toMatchObject({
    width: 40,
    height: 20,
    slope: 2,
    zoom: 5,
  });
});

test('does not emit when the shape changes without a value', () => {
  const { onChange } = setup(undefined);
  fireEvent.click(screen.getByRole('radio', { name: 'EXP' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('changing the base width recomputes the values for every zoom level', () => {
  const { onChange } = setup(makeValue('FIXED'));
  const [width] = screen.getAllByRole('slider');
  fireEvent.keyDown(width, { key: 'ArrowRight', keyCode: 39 });
  fireEvent.keyUp(width, { key: 'ArrowRight', keyCode: 39 });
  expect(onChange).toHaveBeenCalledTimes(1);
  const emitted = onChange.mock.calls[0][0];
  expect(emitted.configs.width).toBe(41);
  expect(emitted.values[0].width).toBe(41);
  expect(emitted.values[28].width).toBe(41);
});

test('only the slope slider applies to the LINEAR shape', () => {
  setup(makeValue('LINEAR'));
  const [, , slope, exponent] = screen.getAllByRole('slider');
  expect(slope).toHaveAttribute('aria-disabled', 'false');
  expect(exponent).toHaveAttribute('aria-disabled', 'true');
});
