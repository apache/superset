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
  parseEChartOptions,
  safeParseEChartOptions,
  EChartOptionsParseError,
} from './safeEchartOptionsParser';

test('parseEChartOptions returns undefined for empty input', () => {
  expect(parseEChartOptions(undefined)).toEqual({
    success: true,
    data: undefined,
  });
  expect(parseEChartOptions('')).toEqual({ success: true, data: undefined });
  expect(parseEChartOptions('   ')).toEqual({ success: true, data: undefined });
});

test('parseEChartOptions parses simple object literals', () => {
  const input = `{ title: { text: 'My Chart' } }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({
    title: { text: 'My Chart' },
  });
});

test('parseEChartOptions parses nested objects and arrays', () => {
  const input = `{
    grid: { top: 50, bottom: 50, left: '10%', right: '10%' },
    xAxis: { type: 'category' },
    yAxis: [{ type: 'value' }, { type: 'log' }],
    series: [
      { name: 'Series 1', type: 'line' },
      { name: 'Series 2', type: 'bar' }
    ]
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({
    grid: { top: 50, bottom: 50, left: '10%', right: '10%' },
    xAxis: { type: 'category' },
    yAxis: [{ type: 'value' }, { type: 'log' }],
    series: [
      { name: 'Series 1', type: 'line' },
      { name: 'Series 2', type: 'bar' },
    ],
  });
});

test('parseEChartOptions handles negative numbers in valid properties', () => {
  const input = `{ xAxis: { nameRotate: -45, offset: -10 } }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ xAxis: { nameRotate: -45, offset: -10 } });
});

test('parseEChartOptions handles boolean values in valid properties', () => {
  const input = `{ animation: true, useUTC: false }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ animation: true, useUTC: false });
});

test('parseEChartOptions throws for special numeric values like -Infinity', () => {
  // Special values like -Infinity are not valid JSON-serializable values
  const input = `{ xAxis: { min: -Infinity, splitNumber: 5 } }`;

  // -Infinity is not a valid value for 'min' in the schema
  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
});

test('parseEChartOptions throws for function expressions', () => {
  const input = `{ formatter: function(value) { return value; } }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe('security_error');
  }
});

test('parseEChartOptions throws for arrow functions', () => {
  const input = `{ formatter: (value) => value }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe('security_error');
  }
});

test('parseEChartOptions throws for function calls', () => {
  const input = `{ value: eval('1+1') }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe('security_error');
  }
});

test('parseEChartOptions throws for dangerous identifiers', () => {
  const dangerousInputs = [
    `{ x: window }`,
    `{ x: document }`,
    `{ x: globalThis }`,
    `{ x: process }`,
    `{ x: require }`,
    `{ x: constructor }`,
    `{ x: __proto__ }`,
  ];

  dangerousInputs.forEach(input => {
    expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
    try {
      parseEChartOptions(input);
    } catch (error) {
      expect(error).toBeInstanceOf(EChartOptionsParseError);
      expect((error as EChartOptionsParseError).errorType).toBe(
        'security_error',
      );
    }
  });
});

test('parseEChartOptions throws for computed properties', () => {
  const input = `{ [dynamicKey]: 'value' }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
});

test('parseEChartOptions throws for template literals with expressions', () => {
  const input = '{ text: `Hello ${name}` }';

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
});

test('parseEChartOptions allows simple template literals in valid properties', () => {
  const input = '{ title: { text: `Hello World` } }';
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ title: { text: 'Hello World' } });
});

test('parseEChartOptions throws for new expressions', () => {
  const input = `{ date: new Date() }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
});

test('parseEChartOptions throws for member expressions', () => {
  const input = `{ value: Math.PI }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
});

test('parseEChartOptions handles trailing commas (JSON5-like)', () => {
  const input = `{
    title: { text: 'Chart', },
    series: [
      { name: 'A', },
      { name: 'B', },
    ],
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({
    title: { text: 'Chart' },
    series: [{ name: 'A' }, { name: 'B' }],
  });
});

test('parseEChartOptions handles unquoted keys in nested objects', () => {
  // Unknown top-level keys are filtered, but valid nested keys work
  const input = `{ title: { text: 'value', show: true } }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({
    title: { text: 'value', show: true },
  });
});

test('safeParseEChartOptions throws on parse error', () => {
  expect(() => safeParseEChartOptions('{ invalid')).toThrow(
    EChartOptionsParseError,
  );
});

test('safeParseEChartOptions throws on security error', () => {
  expect(() => safeParseEChartOptions('{ fn: () => {} }')).toThrow(
    EChartOptionsParseError,
  );
});

test('safeParseEChartOptions returns data on success', () => {
  const result = safeParseEChartOptions(`{ title: { text: 'Test' } }`);
  expect(result).toEqual({ title: { text: 'Test' } });
});

test('parseEChartOptions handles complex real-world EChart options', () => {
  const input = `{
    title: {
      text: 'Sales Overview',
      subtext: 'Monthly Data',
      left: 'center',
      textStyle: {
        color: '#333',
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 50
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ccc',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#999'
        }
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100
      },
      {
        type: 'inside'
      }
    ]
  }`;

  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data?.title).toBeDefined();
  expect(result.data?.legend).toBeDefined();
  expect(result.data?.grid).toBeDefined();
  expect(result.data?.tooltip).toBeDefined();
  expect(result.data?.xAxis).toBeDefined();
  expect(result.data?.yAxis).toBeDefined();
  expect(result.data?.dataZoom).toHaveLength(2);
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

test('parseEChartOptions throws when title is a string instead of object', () => {
  // title should be TitleOption (object), not string
  const input = `{ title: 'text' }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
    expect(
      (error as EChartOptionsParseError).validationErrors.length,
    ).toBeGreaterThan(0);
  }
});

test('parseEChartOptions throws when grid is a string instead of object', () => {
  const input = `{ grid: 'invalid' }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
  }
});

test('parseEChartOptions throws when nested property has wrong type', () => {
  // textStyle should be object, not string - this invalidates the entire title
  const input = `{ title: { text: 'Chart', textStyle: 'invalid' } }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
  }
});

test('parseEChartOptions keeps valid nested objects', () => {
  const input = `{ title: { text: 'Chart', textStyle: { color: '#333', fontSize: 14 } } }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data?.title).toEqual({
    text: 'Chart',
    textStyle: { color: '#333', fontSize: 14 },
  });
});

test('parseEChartOptions throws when some properties are invalid', () => {
  const input = `{
    title: { text: 'Valid Title' },
    legend: 'invalid',
    grid: { top: 50 }
  }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
    expect(
      (error as EChartOptionsParseError).validationErrors.some(e =>
        e.includes('legend'),
      ),
    ).toBe(true);
  }
});

test('parseEChartOptions ignores unknown top-level properties', () => {
  const input = `{
    title: { text: 'Chart' },
    unknownProperty: 'should be filtered',
    anotherUnknown: { nested: 'value' }
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data?.title).toEqual({ text: 'Chart' });
  expect(
    (result.data as Record<string, unknown>)?.unknownProperty,
  ).toBeUndefined();
  expect(
    (result.data as Record<string, unknown>)?.anotherUnknown,
  ).toBeUndefined();
});

test('parseEChartOptions throws when array has invalid items', () => {
  // dataZoom array should contain objects, not strings
  const input = `{
    dataZoom: [
      { type: 'slider', start: 0 },
      'invalid',
      { type: 'inside' }
    ]
  }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
    expect(
      (error as EChartOptionsParseError).validationErrors.some(e =>
        e.includes('dataZoom'),
      ),
    ).toBe(true);
  }
});

test('parseEChartOptions validates tooltip properties', () => {
  const input = `{
    tooltip: {
      trigger: 'axis',
      show: true,
      padding: 10
    }
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data?.tooltip).toEqual({
    trigger: 'axis',
    show: true,
    padding: 10,
  });
});

test('parseEChartOptions validates xAxis type property', () => {
  const input = `{
    xAxis: {
      type: 'category',
      name: 'X Axis',
      axisLabel: {
        rotate: 45,
        fontSize: 12
      }
    }
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data?.xAxis).toEqual({
    type: 'category',
    name: 'X Axis',
    axisLabel: {
      rotate: 45,
      fontSize: 12,
    },
  });
});

test('parseEChartOptions throws when number is used where string expected', () => {
  // backgroundColor should be string, not number
  const input = `{ backgroundColor: 123 }`;

  expect(() => parseEChartOptions(input)).toThrow(EChartOptionsParseError);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    expect((error as EChartOptionsParseError).errorType).toBe(
      'validation_error',
    );
  }
});

test('parseEChartOptions accepts valid animation options', () => {
  const input = `{
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    animationDelay: 100
  }`;
  const result = parseEChartOptions(input);

  expect(result.success).toBe(true);
  expect(result.data).toEqual({
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    animationDelay: 100,
  });
});

test('EChartOptionsParseError contains validation error details', () => {
  const input = `{ title: 'invalid', grid: 123 }`;

  expect.assertions(5);
  try {
    parseEChartOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(EChartOptionsParseError);
    const parseError = error as EChartOptionsParseError;
    expect(parseError.errorType).toBe('validation_error');
    expect(parseError.validationErrors.length).toBe(2);
    expect(parseError.validationErrors.some(e => e.includes('title'))).toBe(
      true,
    );
    expect(parseError.validationErrors.some(e => e.includes('grid'))).toBe(
      true,
    );
  }
});
