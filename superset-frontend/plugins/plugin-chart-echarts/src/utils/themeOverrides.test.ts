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
import { mergeReplaceArrays } from '@superset-ui/core';

describe('Theme Override Deep Merge Behavior', () => {
  test('should merge nested objects correctly', () => {
    const baseOptions = {
      grid: {
        left: '5%',
        right: '5%',
        top: '10%',
      },
      xAxis: {
        type: 'category',
        axisLabel: {
          fontSize: 12,
        },
      },
    };

    const globalOverrides = {
      grid: {
        left: '10%',
        bottom: '15%',
      },
      xAxis: {
        axisLabel: {
          color: '#333',
          rotate: 45,
        },
      },
    };

    const result = mergeReplaceArrays(baseOptions, globalOverrides);

    expect(result).toEqual({
      grid: {
        left: '10%', // overridden
        right: '5%', // preserved
        top: '10%', // preserved
        bottom: '15%', // added
      },
      xAxis: {
        type: 'category', // preserved
        axisLabel: {
          fontSize: 12, // preserved
          color: '#333', // added
          rotate: 45, // added
        },
      },
    });
  });

  test('should replace arrays instead of merging them', () => {
    const baseOptions = {
      series: [
        { name: 'Series 1', type: 'line' },
        { name: 'Series 2', type: 'bar' },
      ],
    };

    const overrides = {
      series: [{ name: 'New Series', type: 'pie' }],
    };

    const result = mergeReplaceArrays(baseOptions, overrides);

    // Arrays are replaced entirely, not merged by index
    expect(result.series).toEqual([{ name: 'New Series', type: 'pie' }]);
    expect(result.series).toHaveLength(1);
  });

  test('should handle null overrides correctly', () => {
    const baseOptions = {
      grid: {
        left: '5%',
        right: '5%',
        top: '10%',
      },
      tooltip: {
        show: true,
        backgroundColor: '#fff',
      },
    };

    const overrides = {
      grid: {
        left: null,
        bottom: '20%',
      },
      tooltip: {
        backgroundColor: null,
        borderColor: '#ccc',
      },
    };

    const result = mergeReplaceArrays(baseOptions, overrides);

    expect(result).toEqual({
      grid: {
        left: null, // overridden with null
        right: '5%', // preserved (undefined values are ignored by lodash merge)
        top: '10%', // preserved
        bottom: '20%', // added
      },
      tooltip: {
        show: true, // preserved
        backgroundColor: null, // overridden with null
        borderColor: '#ccc', // added
      },
    });
  });

  test('should handle override precedence correctly', () => {
    const baseTheme = {
      textStyle: { color: '#000', fontSize: 12 },
    };

    const pluginOptions = {
      textStyle: { fontSize: 14 },
      title: { text: 'Chart Title' },
    };

    const globalOverrides = {
      textStyle: { color: '#333' },
      grid: { left: '10%' },
    };

    const chartOverrides = {
      textStyle: { color: '#666', fontWeight: 'bold' },
      legend: { orient: 'vertical' },
    };

    // Simulate the merge order in Echart.tsx
    const result = mergeReplaceArrays(
      baseTheme,
      pluginOptions,
      globalOverrides,
      chartOverrides,
    );

    expect(result).toEqual({
      textStyle: {
        color: '#666', // chart override wins
        fontSize: 14, // from plugin options
        fontWeight: 'bold', // from chart override
      },
      title: { text: 'Chart Title' }, // from plugin options
      grid: { left: '10%' }, // from global override
      legend: { orient: 'vertical' }, // from chart override
    });
  });

  test('should preserve deep nested structures', () => {
    const baseOptions = {
      xAxis: {
        axisLabel: {
          textStyle: {
            color: '#000',
            fontSize: 12,
            fontFamily: 'Arial',
          },
        },
      },
    };

    const overrides = {
      xAxis: {
        axisLabel: {
          textStyle: {
            color: '#333',
            fontWeight: 'bold',
          },
          rotate: 45,
        },
        splitLine: {
          show: true,
        },
      },
    };

    const result = mergeReplaceArrays(baseOptions, overrides);

    expect(result).toEqual({
      xAxis: {
        axisLabel: {
          textStyle: {
            color: '#333', // overridden
            fontSize: 12, // preserved
            fontFamily: 'Arial', // preserved
            fontWeight: 'bold', // added
          },
          rotate: 45, // added
        },
        splitLine: {
          show: true, // added
        },
      },
    });
  });

  test('should handle function values correctly', () => {
    const formatFunction = (value: any) => `${value}%`;
    const overrideFunction = (value: any) => `$${value}`;

    const baseOptions = {
      yAxis: {
        axisLabel: {
          formatter: formatFunction,
        },
      },
    };

    const overrides = {
      yAxis: {
        axisLabel: {
          formatter: overrideFunction,
        },
      },
    };

    const result = mergeReplaceArrays(baseOptions, overrides);

    expect(result.yAxis.axisLabel.formatter).toBe(overrideFunction);
    expect(result.yAxis.axisLabel.formatter('100')).toBe('$100');
  });

  test('should handle empty objects and arrays', () => {
    const baseOptions = {
      series: [{ name: 'Test', data: [1, 2, 3] }],
      grid: { left: '5%' },
    };

    const emptyOverrides = {};
    const arrayOverride = { series: [] };
    const objectOverride = { grid: {} };

    const resultEmpty = mergeReplaceArrays(baseOptions, emptyOverrides);
    const resultArray = mergeReplaceArrays(baseOptions, arrayOverride);
    const resultObject = mergeReplaceArrays(baseOptions, objectOverride);

    expect(resultEmpty).toEqual(baseOptions);
    // Empty array completely replaces existing array
    expect(resultArray.series).toEqual([]);
    expect(resultObject.grid).toEqual({ left: '5%' });
  });
});
