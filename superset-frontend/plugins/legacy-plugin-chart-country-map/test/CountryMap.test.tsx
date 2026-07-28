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

import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import d3 from 'd3';
import ReactCountryMap from '../src/ReactCountryMap';

// d3 v3 APIs have loose types; cast to allow jest mock operations
const d3Any = d3 as any;

jest.spyOn(d3Any, 'json');

type Projection = ((...args: unknown[]) => void) & {
  scale: () => Projection;
  center: () => Projection;
  translate: () => Projection;
};

type PathFn = (() => string) & {
  projection: jest.Mock;
  bounds: jest.Mock<[[number, number], [number, number]]>;
  centroid: jest.Mock<[number, number]>;
};

const mockPath: PathFn = jest.fn(() => 'M10 10 L20 20') as unknown as PathFn;
mockPath.projection = jest.fn();
mockPath.bounds = jest.fn(() => [
  [0, 0],
  [100, 100],
]);
mockPath.centroid = jest.fn(() => [50, 50]);

jest.spyOn(d3Any.geo, 'path').mockImplementation(() => mockPath);

// Mock d3.geo.mercator
jest.spyOn(d3Any.geo, 'mercator').mockImplementation(() => {
  const proj = (() => {}) as Projection;
  proj.scale = () => proj;
  proj.center = () => proj;
  proj.translate = () => proj;
  return proj;
});

// Mock d3.mouse
jest.spyOn(d3Any, 'mouse').mockReturnValue([100, 50]);

const mockMapData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { ISO: 'CAN', NAME_1: 'Canada' },
      geometry: {},
    },
  ],
};

type D3JsonCallback = (error: Error | null, data: unknown) => void;

describe('CountryMap (legacy d3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders a map after d3.json loads data', async () => {
    d3Any.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
      cb(null, mockMapData),
    );

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        numberFormat=".2f"
        formatter={jest.fn().mockReturnValue('100')}
      />,
    );

    expect(d3Any.json).toHaveBeenCalledTimes(1);

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();
  });

  test('shows tooltip on mouseenter/mousemove/mouseout', async () => {
    d3Any.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
      cb(null, mockMapData),
    );

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        formatter={jest.fn().mockReturnValue('100')}
      />,
    );

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();

    const popup = document.querySelector('.hover-popup');
    expect(popup).not.toBeNull();

    fireEvent.mouseEnter(region!);
    expect(popup!).toHaveStyle({ display: 'block' });

    fireEvent.mouseOut(region!);
    expect(popup!).toHaveStyle({ display: 'none' });
  });

  test('emits a cross-filter data mask when a region is clicked', () => {
    d3Any.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
      cb(null, mockMapData),
    );
    const setDataMask = jest.fn();

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        formatter={jest.fn().mockReturnValue('100')}
        entity="country_code"
        emitCrossFilters
        setDataMask={setDataMask}
        filterState={{ selectedValues: [] }}
      />,
    );

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();

    // A click is only treated as a selection when it follows a mousedown
    // without dragging beyond the threshold (d3.mouse is mocked to a fixed
    // position, so the down/up positions match).
    fireEvent.mouseDown(region!);
    fireEvent.click(region!);

    expect(setDataMask).toHaveBeenCalledTimes(1);
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: {
          filters: [{ col: 'country_code', op: 'IN', val: ['CAN'] }],
        },
        filterState: expect.objectContaining({ value: ['CAN'] }),
      }),
    );
  });

  test('does not emit a cross-filter when emitCrossFilters is disabled', () => {
    d3Any.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
      cb(null, mockMapData),
    );
    const setDataMask = jest.fn();

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        formatter={jest.fn().mockReturnValue('100')}
        entity="country_code"
        emitCrossFilters={false}
        setDataMask={setDataMask}
        filterState={{ selectedValues: [] }}
      />,
    );

    const region = document.querySelector('path.region');
    fireEvent.mouseDown(region!);
    fireEvent.click(region!);

    expect(setDataMask).not.toHaveBeenCalled();
  });

  test('opens the context menu with drill-by keyed on the entity control', () => {
    d3Any.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
      cb(null, mockMapData),
    );
    const onContextMenu = jest.fn();

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        formatter={jest.fn().mockReturnValue('100')}
        entity="country_code"
        onContextMenu={onContextMenu}
        filterState={{ selectedValues: [] }}
      />,
    );

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();

    fireEvent.contextMenu(region!, { clientX: 123, clientY: 45 });

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    const [[clientX, clientY, payload]] = onContextMenu.mock.calls;
    expect(clientX).toBe(123);
    expect(clientY).toBe(45);
    expect(payload.drillToDetail).toEqual([
      { col: 'country_code', op: '==', val: 'CAN', formattedVal: 'CAN' },
    ]);
    // groupbyFieldName must be the form-data control key ('entity'), not the
    // selected column value ('country_code'), so DrillByModal can map the
    // selection back to the chart control.
    expect(payload.drillBy).toEqual({
      filters: [{ col: 'country_code', op: '==', val: 'CAN' }],
      groupbyFieldName: 'entity',
    });
  });
});
