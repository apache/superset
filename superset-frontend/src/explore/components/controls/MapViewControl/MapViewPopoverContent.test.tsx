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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import MapViewPopoverContent from './MapViewPopoverContent';
import { MapViewConfigs } from './types';

const conf: MapViewConfigs = {
  mode: 'CUSTOM',
  zoom: 7,
  latitude: 48.5,
  longitude: 9.25,
  fixedZoom: 4,
  fixedLatitude: 10,
  fixedLongitude: 20,
};

const setup = () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <MapViewPopoverContent
      mapViewConf={conf}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
};

test('renders the fixed extent in the zoom, latitude and longitude inputs', () => {
  setup();
  const [zoom, latitude, longitude] = screen.getAllByRole('spinbutton');
  expect(zoom).toHaveValue('4');
  expect(latitude).toHaveValue('10');
  expect(longitude).toHaveValue('20');
});

test('saves the edited extent', async () => {
  const { onSave } = setup();
  const [zoom, latitude] = screen.getAllByRole('spinbutton');
  await userEvent.clear(zoom);
  await userEvent.type(zoom, '12');
  await userEvent.clear(latitude);
  await userEvent.type(latitude, '-33');
  await userEvent.click(screen.getByRole('button', { name: 'save' }));
  expect(onSave).toHaveBeenCalledWith({
    ...conf,
    fixedZoom: 12,
    fixedLatitude: -33,
  });
});

test('closing discards the edits and calls onClose', async () => {
  const { onSave, onClose } = setup();
  const [zoom] = screen.getAllByRole('spinbutton');
  await userEvent.clear(zoom);
  await userEvent.type(zoom, '9');
  await userEvent.click(screen.getByRole('button', { name: 'close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getAllByRole('spinbutton')[0]).toHaveValue('4');
});
