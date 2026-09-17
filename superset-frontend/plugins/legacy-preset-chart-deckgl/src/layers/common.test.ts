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

import { JsonObject, QueryFormData } from '@superset-ui/core';
import { getAggFunc, commonLayerProps } from './common';

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
    const props = commonLayerProps(
      formData,
      mockSetTooltip,
      mockSetTooltipContent,
    );
    expect(props.pickable).toBe(true);
    expect(props.onHover).toBeDefined();
  });

  it('calls onHover and sets tooltip', () => {
    const formData = { ...partialformData, js_tooltip: null } as QueryFormData;
    const props = commonLayerProps(
      formData,
      mockSetTooltip,
      mockSetTooltipContent,
    );

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
    const props = commonLayerProps(
      formData,
      mockSetTooltip,
      mockSetTooltipContent,
      mockOnSelect,
    );

    const mockObject = { object: { name: 'John Doe' } };
    props.onClick?.(mockObject);
    expect(mockOnSelect).toHaveBeenCalledWith('John Doe');
  });
});
