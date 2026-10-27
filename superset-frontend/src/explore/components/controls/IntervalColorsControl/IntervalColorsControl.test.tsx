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

test('disables editing while intervals has a blank token between numbers', async () => {
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,,60"
      colorScheme="testScheme"
    />,
  );

  // The blank middle token means the list is still being edited; don't
  // allow commits that would misalign colors once the blank is filled in.
  // Pin the row count first so the per-row assertions can't pass vacuously.
  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);
  triggers.forEach(trigger => {
    expect(trigger).toHaveClass('ant-color-picker-trigger-disabled');
  });

  // A change attempt on a disabled picker must neither open it nor commit.
  await userEvent.click(triggers[0]);
  expect(
    document.querySelector('.ant-color-picker-presets-color'),
  ).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
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

test('a non-positive legacy index falls back to the positional scheme color like the renderer', () => {
  // The renderer computes `colors[(ind - 1) % n]`, which is `undefined` for
  // index 0, so that band uses `colors[idx]`; it must not wrap to the last
  // scheme color.
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      legacyIntervalColorIndices="0,2"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText('#1F77B4')).toBeInTheDocument();
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.queryByText('#2CA02C')).not.toBeInTheDocument();
});

test('stays read-only when legacy indices cannot be resolved so untouched bands are never rewritten', async () => {
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,60"
      legacyIntervalColorIndices="10,3"
      colorScheme="testScheme"
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);
  triggers.forEach(trigger => {
    expect(trigger).toHaveClass('ant-color-picker-trigger-disabled');
  });
  await userEvent.click(triggers[0]);
  expect(onChange).not.toHaveBeenCalled();
});

test('an empty value array does not count as explicit colors, so unresolved legacy indices stay read-only', async () => {
  // The Gauge control defaults `interval_colors` to `[]`; that must not
  // re-enable editing for a chart whose legacy indices cannot be resolved.
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,60"
      value={[]}
      legacyIntervalColorIndices="10,3"
      colorScheme="testScheme"
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);
  triggers.forEach(trigger => {
    expect(trigger).toHaveClass('ant-color-picker-trigger-disabled');
  });
  await userEvent.click(triggers[0]);
  expect(onChange).not.toHaveBeenCalled();
});

test('a legacy index past the scheme length leaves every legacy index unresolved', () => {
  // The renderer may index a palette that grew past the static scheme, so
  // wrapping modulo the scheme length would show (and later persist) a
  // different color than the chart renders.
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      legacyIntervalColorIndices="10,3"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText('#1F77B4')).toBeInTheDocument();
  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.queryByText('#2CA02C')).not.toBeInTheDocument();
});

test('a legacy index past the scheme length beyond the rendered bounds is ignored', () => {
  render(
    <IntervalColorsControl
      onChange={jest.fn()}
      intervals="20,60"
      legacyIntervalColorIndices="2,3,7"
      colorScheme="testScheme"
    />,
  );

  expect(screen.getByText('#FF7F0E')).toBeInTheDocument();
  expect(screen.getByText('#2CA02C')).toBeInTheDocument();
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

test('stays editable when explicit colors exist even if the legacy indices are unresolvable', async () => {
  // Out-of-palette legacy indices make the control read-only only while no
  // explicit color has been stored; once `interval_colors` exists the
  // renderer ignores the legacy indices, so editing must remain enabled.
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,60"
      value={['#ff0000']}
      legacyIntervalColorIndices="10,3"
      colorScheme="testScheme"
    />,
  );

  const triggers = document.querySelectorAll('.ant-color-picker-trigger');
  expect(triggers).toHaveLength(2);
  triggers.forEach(trigger => {
    expect(trigger).not.toHaveClass('ant-color-picker-trigger-disabled');
  });

  await userEvent.click(triggers[0]);
  await waitFor(() => {
    expect(
      document.querySelector('.ant-color-picker-presets-color'),
    ).toBeInTheDocument();
  });

  const presets = document.querySelectorAll('.ant-color-picker-presets-color');
  await userEvent.click(presets[0]);

  expect(onChange).toHaveBeenCalled();
});

test('keeps every legacy band color while the last interval bound is being retyped', async () => {
  // Same trailing-blank window as below, but for a legacy chart that has no
  // explicit `interval_colors` yet: bounds "20,40,60" with legacy indices
  // "3,2,1", then the user erases "60" and edits the first color while
  // `intervals` reads "20,40,". The legacy indices are the only record of
  // the third band at that moment, so the write must still cover it with
  // its legacy color (index 1 -> scheme[0]); otherwise a two-entry explicit
  // array would be persisted and, once "60" is typed back in, the third
  // band would flip to the positional scheme color instead.
  const onChange = jest.fn();
  render(
    <IntervalColorsControl
      onChange={onChange}
      intervals="20,40,"
      legacyIntervalColorIndices="3,2,1"
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
  await userEvent.click(presets[2]);

  expect(onChange).toHaveBeenCalledWith(['#2ca02c', '#ff7f0e', '#1f77b4']);
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
