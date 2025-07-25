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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { PickingInfo } from '@deck.gl/core';
import { JsonObject, QueryFormData } from '@superset-ui/core';
import {
  getAggFunc,
  commonLayerProps,
  getColorForBreakpoints,
  getColorRange,
} from './common';
import { ColorBreakpointType } from '../types';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../utilities/utils';
import { DEFAULT_DECKGL_COLOR } from '../utilities/Shared_DeckGL';

const partialformData: Partial<QueryFormData> = {
  viz_type: 'table',
  datasource: '3_sqla',
};

describe('getAggFunc', () => {
  it('returns correct function for sum', () => {
    const aggFunc = getAggFunc('sum');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBe(10);
  });

  it('returns correct function for min', () => {
    const aggFunc = getAggFunc('min');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBe(1);
  });

  it('returns correct function for max', () => {
    const aggFunc = getAggFunc('max');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBe(4);
  });

  it('returns correct function for mean', () => {
    const aggFunc = getAggFunc('mean');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBe(2.5);
  });

  it('returns correct function for median', () => {
    const aggFunc = getAggFunc('median');
    const result = aggFunc([1, 2, 3, 4, 5]);
    expect(result).toBe(3);
  });

  it('returns correct function for variance', () => {
    const aggFunc = getAggFunc('variance');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBeCloseTo(1.6666666666666667);
  });

  it('returns correct function for deviation', () => {
    const aggFunc = getAggFunc('deviation');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBeCloseTo(1.29099, 5);
  });

  it('returns correct function for count', () => {
    const aggFunc = getAggFunc('count');
    const result = aggFunc([1, 2, 3, 4]);
    expect(result).toBe(4);
  });

  it('returns correct function for p95 (percentiles)', () => {
    const aggFunc = getAggFunc('p95');
    const result = aggFunc([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result).toBeCloseTo(9.55, 5);
  });

  it('throws an error for unsupported aggregation type', () => {
    expect(() => getAggFunc('unsupported')).toThrow(
      'Unsupported aggregation type: unsupported',
    );
  });
});

describe('commonLayerProps', () => {
  const mockSetTooltip = jest.fn();
  const mockSetTooltipContent = jest.fn(
    () => (o: JsonObject) => `Tooltip for ${o}`,
  );
  const mockOnSelect = jest.fn();

  it('returns correct props when js_tooltip is provided', () => {
    const formData = {
      ...partialformData,
      js_tooltip: 'tooltip => tooltip.content',
    } as QueryFormData;
    const props = commonLayerProps({
      formData,
      setTooltip: mockSetTooltip,
      setTooltipContent: mockSetTooltipContent,
    });
    expect(props.pickable).toBe(true);
    expect(props.onHover).toBeDefined();
  });

  it('calls onHover and sets tooltip', () => {
    const formData = { ...partialformData, js_tooltip: null } as QueryFormData;
    const props = commonLayerProps({
      formData,
      setTooltip: mockSetTooltip,
      setTooltipContent: mockSetTooltipContent,
    });

    const mockObject = { picked: true, x: 10, y: 20 };
    props.onHover?.(mockObject);
    expect(mockSetTooltip).toHaveBeenCalledWith({
      content: expect.any(Function), // Matches any function
      x: 10,
      y: 20,
    });
  });

  it('calls onSelect when table_filter is enabled', () => {
    const formData = {
      ...partialformData,
      table_filter: true,
      line_column: 'name',
    } as QueryFormData;
    const props = commonLayerProps({
      formData,
      setTooltip: mockSetTooltip,
      setTooltipContent: mockSetTooltipContent,
      onSelect: mockOnSelect,
    });

    const pickingData = {
      color: [],
      index: 1,
      coordinate: [-122.40138935788005, 37.77785781376027],
      devicePixel: [345, 428],
      pixel: [172, 116.484375],
      pixelRatio: 2,
      picked: true,
      sourceLayer: {},
      viewport: { zoom: 10 },
      layer: {},
      x: 172,
      y: 116.484375,
      object: { name: 'John Doe' },
    } as unknown as PickingInfo;

    props.onClick?.(pickingData, {});
    expect(mockOnSelect).toHaveBeenCalledWith('John Doe');
  });
});

describe('getColorForBreakpoints', () => {
  const colorBreakpoints: ColorBreakpointType[] = [
    { minValue: 0, maxValue: 10, color: { r: 255, g: 0, b: 0, a: 100 } },
    { minValue: 11, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 100 } },
    { minValue: 21, maxValue: 30, color: { r: 0, g: 0, b: 255, a: 100 } },
  ];

  it('returns correct breakpoint index for value in range', () => {
    const aggFunc = (arr: number[]) => arr[0];
    expect(getColorForBreakpoints(aggFunc, [5], colorBreakpoints)).toBe(1);
    expect(getColorForBreakpoints(aggFunc, [15], colorBreakpoints)).toBe(2);
    expect(getColorForBreakpoints(aggFunc, [25], colorBreakpoints)).toBe(3);
  });

  it('returns 0 if value is not in any breakpoint', () => {
    const aggFunc = () => 100;
    expect(getColorForBreakpoints(aggFunc, [100], colorBreakpoints)).toBe(0);
  });

  it('returns undefined if aggFunc returns undefined', () => {
    const aggFunc = () => undefined;
    expect(
      getColorForBreakpoints(aggFunc, [5], colorBreakpoints),
    ).toBeUndefined();
  });

  it('returns undefined if aggFunc returns array', () => {
    const aggFunc = () => [1, 2];
    expect(
      getColorForBreakpoints(aggFunc, [5], colorBreakpoints),
    ).toBeUndefined();
  });
});

describe('getColorRange', () => {
  const fdBase: any = {
    color_picker: { r: 10, g: 20, b: 30, a: 0.5 },
    color_breakpoints: [
      { minValue: 0, maxValue: 10, color: { r: 255, g: 0, b: 0, a: 1 } },
      { minValue: 11, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 1 } },
    ],
  };

  it('returns color range for linear_palette', () => {
    const colorScale = { range: () => ['#ff0000', '#00ff00'] } as any;
    const result = getColorRange({
      defaultBreakpointsColor: DEFAULT_DECKGL_COLOR,
      colorSchemeType: COLOR_SCHEME_TYPES.linear_palette,
      colorScale,
    });
    expect(result).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
    ]);
  });

  it('returns color range for categorical_palette', () => {
    const colorScale = { range: () => ['#0000ff', '#00ffff'] } as any;
    const result = getColorRange({
      defaultBreakpointsColor: DEFAULT_DECKGL_COLOR,
      colorSchemeType: COLOR_SCHEME_TYPES.categorical_palette,
      colorScale,
    });
    expect(result).toEqual([
      [0, 0, 255, 255],
      [0, 255, 255, 255],
    ]);
  });

  it('returns color range for color_breakpoints', () => {
    const result = getColorRange({
      colorBreakpoints: fdBase.color_breakpoints,
      defaultBreakpointsColor: DEFAULT_DECKGL_COLOR,
      colorSchemeType: COLOR_SCHEME_TYPES.color_breakpoints,
    });
    expect(result).toEqual([
      [
        DEFAULT_DECKGL_COLOR.r,
        DEFAULT_DECKGL_COLOR.g,
        DEFAULT_DECKGL_COLOR.b,
        DEFAULT_DECKGL_COLOR.a * 255,
      ],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
    ]);
  });

  it('returns default color if color_picker is missing', () => {
    const result = getColorRange({
      defaultBreakpointsColor: DEFAULT_DECKGL_COLOR,
      colorSchemeType: 'unknown_type' as ColorSchemeType,
    });
    expect(result).toEqual([
      [
        DEFAULT_DECKGL_COLOR.r,
        DEFAULT_DECKGL_COLOR.g,
        DEFAULT_DECKGL_COLOR.b,
        DEFAULT_DECKGL_COLOR.a * 255,
      ],
    ]);
  });
});
