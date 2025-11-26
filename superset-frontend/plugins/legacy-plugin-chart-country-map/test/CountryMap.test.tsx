/**
 * Tests for legacy D3 CountryMap
 * */

import { render, fireEvent } from '@testing-library/react';
import d3 from 'd3';
import ReactCountryMap from '../src/ReactCountryMap';

// Mock d3.json
jest.spyOn(d3, 'json');

// Mock d3.geo.path
const mockPath = jest.fn(() => 'M10 10 L20 20') as any;
mockPath.projection = jest.fn();
mockPath.bounds = jest.fn(() => [
  [0, 0],
  [100, 100],
]);
mockPath.centroid = jest.fn(() => [50, 50]);

jest.spyOn(d3.geo, 'path').mockImplementation(() => mockPath);

// Mock d3.geo.mercator
jest.spyOn(d3.geo, 'mercator').mockImplementation(() => {
  const proj: any = () => {};
  proj.scale = () => proj;
  proj.center = () => proj;
  proj.translate = () => proj;
  return proj;
});

// Mock d3.mouse
jest.spyOn(d3, 'mouse').mockReturnValue([100, 50]);

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

type D3JsonCallback = (error: Error | null, data: any) => void;

describe('CountryMap (legacy d3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a map after d3.json loads data', async () => {
    d3.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
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
      />,
    );

    expect(d3.json).toHaveBeenCalledTimes(1);

    const region = await document.querySelector('path.region');
    expect(region).not.toBeNull();
  });

  it('shows tooltip on mouseenter/mousemove/mouseout', async () => {
    d3.json.mockImplementation((_url: string, cb: D3JsonCallback) =>
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
      />,
    );

    const region = await document.querySelector('path.region');
    expect(region).not.toBeNull();

    const popup = document.querySelector('.hover-popup');
    expect(popup).not.toBeNull();

    fireEvent.mouseEnter(region!);
    expect(popup!.style.display).toBe('block');

    fireEvent.mouseMove(region!);
    expect(popup!.style.top).toBe('80px'); // mouseY (50) + 30

    fireEvent.mouseOut(region!);
    expect(popup!.style.display).toBe('none');
  });
});
