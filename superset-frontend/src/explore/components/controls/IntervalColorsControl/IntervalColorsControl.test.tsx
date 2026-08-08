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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import IntervalColorsControl from 'src/explore/components/controls/IntervalColorsControl';

beforeAll(() => {
  getCategoricalSchemeRegistry().registerValue(
    'testScheme',
    new CategoricalScheme({
      id: 'testScheme',
      colors: ['#1f77b4', '#ff7f0e', '#2ca02c'],
    }),
  );
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders a hint and no rows when no interval bounds are configured', () => {
  render(<IntervalColorsControl onChange={jest.fn()} />);

  expect(
    screen.getByText('Add interval bounds above to configure colors here.'),
  ).toBeInTheDocument();
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    0,
  );
});

test('renders one color picker row per parsed interval bound', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60,100"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText(/Up to 20/)).toBeInTheDocument();
  expect(screen.getByText(/Up to 60/)).toBeInTheDocument();
  expect(screen.getByText(/Up to 100/)).toBeInTheDocument();
  expect(document.querySelectorAll('.ant-color-picker-trigger')).toHaveLength(
    3,
  );
});

test('falls back to the categorical scheme when there is no explicit value or legacy data', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText('#1F77B4')).toBeInTheDocument();
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
});

test('resolves legacy interval_color_indices against the color scheme for display', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      legacyIntervalColorIndices="2,3"
      colorScheme="testScheme"
    />,
  );

  // 1-indexed: index 2 -> '#ff7f0e', index 3 -> '#2ca02c'
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.getByText('#2CA02C')).toBeInTheDocument();
});

test('explicit value takes precedence over legacy indices', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      value={['#ff0000', '#00ff00']}
      legacyIntervalColorIndices="2,3"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText('#FF0000')).toBeInTheDocument();
  expect(screen.getByText('#00FF00')).toBeInTheDocument();
});

test('calls onChange with the full color array when a row color is picked', async () => {
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,60"
      value={['#ff0000', '#00ff00']}
      colorScheme="testScheme"
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);

  await userEvent.click(triggers[1]);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  await userEvent.click(presets[0]);

  expect(onChange).toHaveBeenCalledWith(['#ff0000', '#1f77b4']);
});
