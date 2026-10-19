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

test('disables editing while intervals has a blank token between numbers', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,,60"
      colorScheme="testScheme"
    />,
  );

  // The blank middle token means the list is still being edited; don't
  // allow commits that would misalign colors once the blank is filled in.
  document.querySelectorAll('.ant-color-picker-trigger').forEach(trigger => {
    expect(trigger).toHaveClass('ant-color-picker-trigger-disabled');
  });
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

test('a single unparseable legacy index discards every legacy index, not just its own', () => {
  // Matches `getIntervalBoundsAndColors` in Gauge/transformProps.ts exactly:
  // one bad token falls back to the positional scheme color for every
  // bound, rather than resolving the other, valid tokens independently.
  // Otherwise this display (and the one-time migration it backs) could
  // disagree with how the chart has always actually rendered.
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      legacyIntervalColorIndices="2,invalid"
      colorScheme="testScheme"
    />,
  );

  // Positional fallback for both rows: index0 -> scheme[0], index1 -> scheme[1].
  expect(screen.getByText('#1F77B4')).toBeInTheDocument();
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.queryByText('#2CA02C')).not.toBeInTheDocument();
});

test('a partial explicit value falls back to the positional scheme color, not legacy indices, for untouched rows', async () => {
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,60"
      value={['#ff0000']}
      legacyIntervalColorIndices="3,1"
      colorScheme="testScheme"
    />,
  );

  // index0 keeps the explicit value; index1 has no explicit entry, and
  // once any explicit color exists the renderer ignores legacy indices for
  // every bound, so it must show the scheme's positional color (index 1 ->
  // '#ff7f0e'), not legacy index "1" -> scheme[0] -> '#1f77b4'.
  expect(screen.getByText('#FF0000')).toBeInTheDocument();
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.queryByText('#1F77B4')).not.toBeInTheDocument();

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);
  await userEvent.click(triggers[0]);

  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  await userEvent.click(presets[1]);

  // Editing row 0 must not silently persist the legacy color for row 1.
  expect(onChange).toHaveBeenCalledWith(['#ff7f0e', '#ff7f0e']);
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

test('keeps a trailing custom color while the last interval bound is being retyped', async () => {
  // Same hazard as `BulletRangeColorsControl`: erasing the last bound
  // leaves `intervals` as "20,40," -- a trailing blank
  // `isRangesInputComplete` tolerates, so editing stays enabled even though
  // there are transiently only 2 parsed bounds. The 3rd saved color must
  // survive that window instead of being truncated away.
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,40,"
      value={['#ff0000', '#00ff00', '#0000ff']}
      colorScheme="testScheme"
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);

  await userEvent.click(triggers[0]);
  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  await userEvent.click(presets[1]);

  expect(onChange).toHaveBeenCalledWith(['#ff7f0e', '#00ff00', '#0000ff']);
});
