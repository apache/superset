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
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import MapViewControl from './MapViewControl';
import { MapViewConfigs } from './types';

const makeValue = (
  overrides: Partial<MapViewConfigs> = {},
): MapViewConfigs => ({
  mode: 'CUSTOM',
  zoom: 7,
  latitude: 48.5,
  longitude: 9.25,
  fixedZoom: 4,
  fixedLatitude: 10,
  fixedLongitude: 20,
  ...overrides,
});

const setup = (value?: MapViewConfigs) => {
  const onChange = jest.fn();
  render(
    <MapViewControl
      name="map_view"
      label="Extent"
      value={value}
      onChange={onChange}
    />,
  );
  return { onChange };
};

test('renders the label and the two extent modes', () => {
  setup(makeValue({ mode: 'FIT_DATA' }));
  expect(screen.getByText('Extent')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Fit data' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Custom' })).not.toBeChecked();
});

test('hides the extent tag and button in fit data mode', () => {
  setup(makeValue({ mode: 'FIT_DATA' }));
  expect(screen.queryByText(/Lat:/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Use current extent' }),
  ).not.toBeInTheDocument();
});

test('shows the fixed extent in custom mode', () => {
  setup(makeValue());
  expect(screen.getByText(/Zoom: 4/)).toHaveTextContent(
    'Zoom: 4 | Lat: 10.000000 | Lon: 20.000000',
  );
  expect(
    screen.getByRole('button', { name: 'Use current extent' }),
  ).toBeInTheDocument();
});

test('shows unset for missing extent values', () => {
  // Saved configs may omit the fixed extent entirely, which the type forbids.
  setup({
    ...makeValue(),
    fixedZoom: undefined,
    fixedLatitude: undefined,
    fixedLongitude: undefined,
  } as unknown as MapViewConfigs);
  expect(screen.getByText(/Zoom:/)).toHaveTextContent(
    'Zoom: unset | Lat: unset | Lon: unset',
  );
});

test('switching to custom mode emits the value with the new mode', () => {
  const { onChange } = setup(makeValue({ mode: 'FIT_DATA' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
  expect(onChange).toHaveBeenLastCalledWith(makeValue({ mode: 'CUSTOM' }));
});

test('switching back to fit data emits the value with the new mode', () => {
  const { onChange } = setup(makeValue());
  fireEvent.click(screen.getByRole('radio', { name: 'Fit data' }));
  expect(onChange).toHaveBeenCalledWith(makeValue({ mode: 'FIT_DATA' }));
});

test('does not emit a mode change without a value', () => {
  const { onChange } = setup(undefined);
  fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('Use current extent copies the live map view into the fixed extent', async () => {
  const { onChange } = setup(makeValue());
  await userEvent.click(
    screen.getByRole('button', { name: 'Use current extent' }),
  );
  expect(onChange).toHaveBeenCalledWith(
    makeValue({ fixedZoom: 7, fixedLatitude: 48.5, fixedLongitude: 9.25 }),
  );
});

test('clicking the extent tag opens the extent editor', async () => {
  setup(makeValue());
  await userEvent.click(screen.getByText(/Lat:/));
  expect(await screen.findAllByRole('spinbutton')).toHaveLength(3);
});

test('saving from the extent editor emits the edited extent', async () => {
  const { onChange } = setup(makeValue());
  await userEvent.click(screen.getByText(/Lat:/));
  const [zoom] = await screen.findAllByRole('spinbutton');
  await userEvent.clear(zoom);
  await userEvent.type(zoom, '11');
  await userEvent.click(screen.getByRole('button', { name: 'save' }));
  expect(onChange).toHaveBeenCalledWith(makeValue({ fixedZoom: 11 }));
});
