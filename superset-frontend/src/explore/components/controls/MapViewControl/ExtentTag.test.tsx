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
import { render, screen } from 'spec/helpers/testing-library';
import { ExtentTag } from './ExtentTag';
import { MapViewConfigs } from './types';

const baseValue: MapViewConfigs = {
  mode: 'CUSTOM',
  zoom: 5,
  latitude: 10,
  longitude: 12,
  fixedZoom: 5,
  fixedLatitude: 10,
  fixedLongitude: 12,
};

test('renders the fixed extent values', () => {
  render(<ExtentTag value={baseValue} onClick={jest.fn()} />);
  expect(
    screen.getByText('Zoom: 5 | Lat: 10.000000 | Lon: 12.000000'),
  ).toBeInTheDocument();
});

test('renders 0 values instead of "unset"', () => {
  render(
    <ExtentTag
      value={{
        ...baseValue,
        fixedZoom: 0,
        fixedLatitude: 0,
        fixedLongitude: 0,
      }}
      onClick={jest.fn()}
    />,
  );
  expect(
    screen.getByText('Zoom: 0 | Lat: 0.000000 | Lon: 0.000000'),
  ).toBeInTheDocument();
});

test('renders "unset" for missing values', () => {
  const value: MapViewConfigs = {
    ...baseValue,
    fixedZoom: undefined,
    fixedLatitude: undefined,
    fixedLongitude: undefined,
  };
  render(<ExtentTag value={value} onClick={jest.fn()} />);
  expect(
    screen.getByText('Zoom: unset | Lat: unset | Lon: unset'),
  ).toBeInTheDocument();
});
