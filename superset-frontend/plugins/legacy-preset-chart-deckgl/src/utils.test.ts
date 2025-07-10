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
import { getColorBreakpointsBuckets } from './utils';
import { ColorBreakpointType } from './types';

jest.mock('@deck.gl/geo-layers', () => ({
  GeoBoundingBox: jest.fn(),
  TileLayer: jest.fn(),
}));

jest.mock('@deck.gl/layers', () => ({
  BitmapLayer: jest.fn(),
  PathLayer: jest.fn(),
}));

jest.mock('@deck.gl/core', () => ({
  Color: jest.fn(),
}));

describe('getColorBreakpointsBuckets', () => {
  it('returns correct buckets for multiple breakpoints', () => {
    const color_breakpoints: ColorBreakpointType[] = [
      { minValue: 0, maxValue: 10, color: { r: 255, g: 0, b: 0, a: 100 } },
      { minValue: 11, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 100 } },
      { minValue: 21, maxValue: 30, color: { r: 0, g: 0, b: 255, a: 100 } },
    ];
    const result = getColorBreakpointsBuckets(color_breakpoints);
    expect(result).toEqual({
      '0 - 10': { color: [255, 0, 0], enabled: true },
      '11 - 20': { color: [0, 255, 0], enabled: true },
      '21 - 30': { color: [0, 0, 255], enabled: true },
    });
  });

  it('returns empty object if color_breakpoints is empty', () => {
    const result = getColorBreakpointsBuckets([]);
    expect(result).toEqual({});
  });

  it('returns empty object if color_breakpoints is missing', () => {
    const result = getColorBreakpointsBuckets({} as any);
    expect(result).toEqual({});
  });
});
