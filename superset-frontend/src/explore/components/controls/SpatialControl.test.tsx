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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import SpatialControl from 'src/explore/components/controls/SpatialControl';

jest.mock('src/explore/components/controls/SelectControl', () => ({
  __esModule: true,
  default: ({
    name,
    value,
    ariaLabel,
  }: {
    name: string;
    value: string;
    ariaLabel: string;
  }) => (
    <div data-test={`select-${name}`} aria-label={ariaLabel}>
      {value}
    </div>
  ),
}));

jest.mock('src/explore/components/ControlHeader', () => ({
  __esModule: true,
  default: () => <div data-test="control-header" />,
}));

const defaultChoices: [string, string][] = [
  ['longitude', 'longitude'],
  ['latitude', 'latitude'],
  ['geo_point', 'geo_point'],
];

test('renders label content showing column names for latlong type', async () => {
  const onChange = jest.fn();
  render(
    <SpatialControl
      onChange={onChange}
      choices={defaultChoices}
      value={{ type: 'latlong', latCol: 'latitude', lonCol: 'longitude' }}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('longitude | latitude')).toBeInTheDocument();
  });
});

test('renders N/A when columns are not set', async () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={[]} />);

  await waitFor(() => {
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});

test('calls onChange with latlong value when initialized with choices', async () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={defaultChoices} />);

  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith(
      {
        type: 'latlong',
        latCol: 'longitude',
        lonCol: 'longitude',
      },
      [],
    );
  });
});

test('calls onChange with errors when no choices are available', async () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={[]} />);

  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith(
      {
        type: 'latlong',
        latCol: undefined,
        lonCol: undefined,
      },
      ['Invalid lat/long configuration.'],
    );
  });
});

test('renders label with lonlatCol for delimited type', async () => {
  const onChange = jest.fn();
  render(
    <SpatialControl
      onChange={onChange}
      choices={defaultChoices}
      value={{ type: 'delimited', lonlatCol: 'geo_point', delimiter: ',' }}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('geo_point')).toBeInTheDocument();
  });
});

test('renders label with geohashCol for geohash type', async () => {
  const onChange = jest.fn();
  render(
    <SpatialControl
      onChange={onChange}
      choices={defaultChoices}
      value={{ type: 'geohash', geohashCol: 'geo_point' }}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('geo_point')).toBeInTheDocument();
  });
});

test('opens popover with three sections when label is clicked', async () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={defaultChoices} />);

  const label = await screen.findByText(/longitude/);
  await userEvent.click(label);

  await waitFor(() => {
    expect(
      screen.getByText('Longitude & Latitude columns'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Delimited long & lat single column'),
    ).toBeInTheDocument();
    expect(screen.getByText('Geohash')).toBeInTheDocument();
  });
});

test('renders ControlHeader', () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={defaultChoices} />);

  expect(screen.getByTestId('control-header')).toBeInTheDocument();
});

test('defaults latCol and lonCol to first choice when no value provided', async () => {
  const onChange = jest.fn();
  render(<SpatialControl onChange={onChange} choices={defaultChoices} />);

  await waitFor(() => {
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'latlong',
        latCol: 'longitude',
        lonCol: 'longitude',
      }),
      [],
    );
  });

  expect(screen.getByText('longitude | longitude')).toBeInTheDocument();
});
