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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import MapMaxExtentViewControl from '../../src/components/MapMaxExtentControl/MapMaxExtentViewControl';
import { MapMaxExtentConfigs } from '../../src/types';

const baseValue: MapMaxExtentConfigs = {
  extentMode: 'CUSTOM',
  maxX: 10,
  maxY: 20,
  minX: -10,
  minY: -20,
  fixedMaxX: 1,
  fixedMaxY: 2,
  fixedMinX: -1,
  fixedMinY: -2,
};

const unsetFixed = {
  fixedMaxX: undefined,
  fixedMaxY: undefined,
  fixedMinX: undefined,
  fixedMinY: undefined,
};

const BUTTON_TEXT = 'Use current extent';

const renderControl = (
  value: MapMaxExtentConfigs | undefined,
  onChange?: jest.Mock,
) =>
  render(
    <MapMaxExtentViewControl
      name="map_max_extent"
      label="Max extent"
      value={value}
      onChange={onChange}
    />,
  );

test('renders the label', () => {
  renderControl(baseValue);

  expect(screen.getByText('Max extent')).toBeInTheDocument();
});

test('NONE mode checks the NONE radio and hides the tag and button', () => {
  renderControl({ ...baseValue, extentMode: 'NONE' });

  expect(screen.getByRole('radio', { name: 'NONE' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'CUSTOM' })).not.toBeChecked();
  expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(/Upper right/)).not.toBeInTheDocument();
});

test('CUSTOM mode checks the CUSTOM radio and shows the tag and button', () => {
  renderControl(baseValue);

  expect(screen.getByRole('radio', { name: 'CUSTOM' })).toBeChecked();
  expect(screen.getByText(BUTTON_TEXT)).toBeInTheDocument();
  expect(screen.getByText(/2\.000000 \| 1\.000000/)).toBeInTheDocument();
  expect(screen.getByText(/-2\.000000 \| -1\.000000/)).toBeInTheDocument();
});

test('CUSTOM mode shows "unset" in the tag when no fixed extent is set', () => {
  renderControl({ ...baseValue, ...unsetFixed });

  expect(screen.getAllByText(/unset/)).toHaveLength(1);
  expect(screen.getByText(/Upper right/)).toHaveTextContent(/unset/);
  expect(screen.getByText(/Lower left/)).toBeInTheDocument();
});

test('renders without a value', () => {
  renderControl(undefined);

  expect(screen.getByRole('radio', { name: 'NONE' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'CUSTOM' })).not.toBeChecked();
  expect(screen.queryByText(BUTTON_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(/Upper right/)).not.toBeInTheDocument();
});

test('selecting CUSTOM keeps the rest of the value', async () => {
  const onChange = jest.fn();
  renderControl({ ...baseValue, extentMode: 'NONE' }, onChange);

  await userEvent.click(screen.getByRole('radio', { name: 'CUSTOM' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({
    ...baseValue,
    extentMode: 'CUSTOM',
  });
});

test('selecting NONE clears the fixed extent but keeps the extent', async () => {
  const onChange = jest.fn();
  renderControl(baseValue, onChange);

  await userEvent.click(screen.getByRole('radio', { name: 'NONE' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({
    ...baseValue,
    ...unsetFixed,
    extentMode: 'NONE',
  });
});

test('"Use current extent" copies the extent to the fixed extent', async () => {
  const onChange = jest.fn();
  renderControl({ ...baseValue, ...unsetFixed }, onChange);

  await userEvent.click(screen.getByText(BUTTON_TEXT));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({
    ...baseValue,
    fixedMaxX: baseValue.maxX,
    fixedMaxY: baseValue.maxY,
    fixedMinX: baseValue.minX,
    fixedMinY: baseValue.minY,
  });
});

test('does not call onChange on radio click without a value', async () => {
  const onChange = jest.fn();
  renderControl(undefined, onChange);

  await userEvent.click(screen.getByRole('radio', { name: 'CUSTOM' }));

  expect(onChange).not.toHaveBeenCalled();
});

test('does not throw on radio click when onChange is omitted', async () => {
  renderControl(baseValue);

  await userEvent.click(screen.getByRole('radio', { name: 'NONE' }));

  expect(screen.getByRole('radio', { name: 'CUSTOM' })).toBeInTheDocument();
});
