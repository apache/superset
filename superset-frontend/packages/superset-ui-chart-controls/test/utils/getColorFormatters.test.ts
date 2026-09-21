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
import { configure } from '@apache-superset/core/translation';
import {
  Comparator,
  getOpacity,
  round,
  getColorFunction,
  getDivergingColor,
  BoundUnit,
  PercentDenominator,
} from '../../src';
import {
  getColorFormatters,
  getReadableTextColor,
  getNormalizedTextColor,
  getTextColorForBackground,
} from '../../src/utils/getColorFormatters';

configure();
const mockData = [
  { count: 50, sum: 200 },
  { count: 100, sum: 400 },
];
const countValues = mockData.map(row => row.count);

const strData = [{ name: 'Brian' }, { name: 'Carlos' }, { name: 'Diana' }];
const strValues = strData.map(row => row.name);

const boolData = [{ isMember: true }, { isMember: false }, { isMember: null }];
const boolValues = boolData.map(row => row.isMember);

test('round', () => {
  expect(round(1)).toEqual(1);
  expect(round(1, 2)).toEqual(1);
  expect(round(0.6)).toEqual(1);
  expect(round(0.6, 1)).toEqual(0.6);
  expect(round(0.64999, 2)).toEqual(0.65);
});

test('getOpacity', () => {
  expect(getOpacity(100, 100, 100)).toEqual(1);
  expect(getOpacity(75, 50, 100)).toEqual(0.53);
  expect(getOpacity(75, 100, 50)).toEqual(0.53);
  expect(getOpacity(100, 100, 50)).toEqual(0.05);
  expect(getOpacity(100, 100, 100, 0, 0.8)).toEqual(0.8);
  expect(getOpacity(100, 100, 50, 0, 1)).toEqual(0);
  expect(getOpacity(999, 100, 50, 0, 1)).toEqual(1);
  expect(getOpacity(100, 100, 50, 0.99, 1)).toEqual(0.99);
  expect(getOpacity(99, 100, 50, 0, 1)).toEqual(0.02);

  expect(getOpacity('100', 100, 100)).toEqual(1);
  expect(getOpacity('75', 50, 100)).toEqual(1);
  expect(getOpacity('50', '100', '100')).toEqual(1);
  expect(getOpacity('50', '75', '100')).toEqual(1);
  expect(getOpacity('50', NaN, '100')).toEqual(1);
  expect(getOpacity('50', '75', NaN)).toEqual(1);
  expect(getOpacity('50', NaN, 100)).toEqual(1);
  expect(getOpacity('50', '75', NaN)).toEqual(1);
  expect(getOpacity('50', NaN, NaN)).toEqual(1);

  expect(getOpacity(75, 50, 100)).toEqual(0.53);
  expect(getOpacity(100, 50, 100)).toEqual(1);
  expect(getOpacity(75, '50', 100)).toEqual(0.53);
  expect(getOpacity(75, 50, '100')).toEqual(0.53);
  expect(getOpacity(75, '50', '100')).toEqual(0.53);
  expect(getOpacity(50, NaN, NaN)).toEqual(1);
  expect(getOpacity(50, NaN, 100)).toEqual(1);
  expect(getOpacity(50, NaN, '100')).toEqual(1);
  expect(getOpacity(50, '75', NaN)).toEqual(1);
  expect(getOpacity(50, 75, NaN)).toEqual(1);
});

test('getDivergingColor parses string color endpoints', () => {
  expect(
    getDivergingColor(25, 0, 50, 100, '#ff0000', '#ffffff', '#008000'),
  ).toEqual('#ff8080');
});

test('getDivergingColor returns the segment endpoint outright when its range has zero width', () => {
  expect(
    getDivergingColor(10, 10, 10, 20, '#ff0000', '#ffffff', '#008000'),
  ).toEqual('#ffffff');
});

test('getColorFunction GREATER_THAN', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction LESS_THAN', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessThan,
      targetValue: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(100)).toBeUndefined();
  expect(colorFunction(50)).toEqual('#FF0000FF');
});

test('getReadableTextColor returns white for dark backgrounds', () => {
  expect(getReadableTextColor('#111111', '#ffffff')).toBe('rgb(255, 255, 255)');
});

test('getReadableTextColor returns black for light backgrounds', () => {
  expect(getReadableTextColor('#f5f5f5', '#ffffff')).toBe('rgb(0, 0, 0)');
});

test('getReadableTextColor blends alpha over the provided surface', () => {
  expect(getReadableTextColor('rgba(0, 0, 0, 0.6)', '#ffffff')).toBe(
    'rgb(255, 255, 255)',
  );
  expect(getReadableTextColor('rgba(255, 255, 255, 0.6)', '#000000')).toBe(
    'rgb(0, 0, 0)',
  );
});

test('getReadableTextColor returns undefined for invalid colors', () => {
  expect(getReadableTextColor('not-a-color', '#ffffff')).toBeUndefined();
  expect(getReadableTextColor('#111111', 'not-a-color')).toBeUndefined();
});

test('getTextColorForBackground prefers explicit text color', () => {
  expect(
    getTextColorForBackground(
      { backgroundColor: '#111111', color: '#ace1c4ff' },
      '#ffffff',
    ),
  ).toBe('rgb(172, 225, 196)');
});

test('getNormalizedTextColor removes alpha from explicit text colors', () => {
  expect(getNormalizedTextColor('#ace1c40d')).toBe('rgb(172, 225, 196)');
  expect(getNormalizedTextColor('rgba(172, 225, 196, 0.2)')).toBe(
    'rgb(172, 225, 196)',
  );
});

test('getNormalizedTextColor preserves invalid explicit text colors', () => {
  expect(getNormalizedTextColor('not-a-color')).toBe('not-a-color');
});

test('getTextColorForBackground normalizes explicit text color alpha', () => {
  expect(
    getTextColorForBackground(
      { backgroundColor: '#111111', color: '#ace1c40d' },
      '#ffffff',
    ),
  ).toBe('rgb(172, 225, 196)');
});

test('getTextColorForBackground falls back to adaptive contrast', () => {
  expect(
    getTextColorForBackground({ backgroundColor: '#111111' }, '#ffffff'),
  ).toBe('rgb(255, 255, 255)');
  expect(getTextColorForBackground({}, '#ffffff')).toBeUndefined();
});

test('getColorFunction GREATER_OR_EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterOrEqual,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toEqual('#FF00000D');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(0)).toBeUndefined();
});

test('getColorFunction LESS_OR_EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessOrEqual,
      targetValue: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toEqual('#FF0000FF');
  expect(colorFunction(100)).toEqual('#FF00000D');
  expect(colorFunction(150)).toBeUndefined();
});

test('getColorFunction EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Equal,
      targetValue: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction NOT_EQUAL', () => {
  let colorFunction = getColorFunction(
    {
      operator: Comparator.NotEqual,
      targetValue: 60,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(60)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(50)).toEqual('#FF00004A');

  colorFunction = getColorFunction(
    {
      operator: Comparator.NotEqual,
      targetValue: 90,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(90)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF00004A');
  expect(colorFunction(50)).toEqual('#FF0000FF');
});

test('getColorFunction BETWEEN', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Between,
      targetValueLeft: 75,
      targetValueRight: 125,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF000087');
});

test('getColorFunction BETWEEN_OR_EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.BetweenOrEqual,
      targetValueLeft: 50,
      targetValueRight: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toEqual('#FF00000D');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(150)).toBeUndefined();
});

test('getColorFunction BETWEEN_OR_EQUAL without opacity', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.BetweenOrEqual,
      targetValueLeft: 50,
      targetValueRight: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
    false,
  );
  expect(colorFunction(25)).toBeUndefined();
  expect(colorFunction(50)).toEqual('#FF0000');
  expect(colorFunction(75)).toEqual('#FF0000');
  expect(colorFunction(100)).toEqual('#FF0000');
  expect(colorFunction(125)).toBeUndefined();
});

test('getColorFunction BETWEEN_OR_LEFT_EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.BetweenOrLeftEqual,
      targetValueLeft: 50,
      targetValueRight: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toEqual('#FF00000D');
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction BETWEEN_OR_RIGHT_EQUAL', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.BetweenOrRightEqual,
      targetValueLeft: 50,
      targetValueRight: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction GREATER_THAN with target value undefined', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: undefined,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction BETWEEN with target value left undefined', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Between,
      targetValueLeft: undefined,
      targetValueRight: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction BETWEEN with target value right undefined', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Between,
      targetValueLeft: 50,
      targetValueRight: undefined,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction unsupported operator', () => {
  const colorFunction = getColorFunction(
    {
      // @ts-expect-error
      operator: 'unsupported operator',
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction with operator None', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(20)).toEqual(undefined);
  expect(colorFunction(50)).toEqual('#FF000000');
  expect(colorFunction(75)).toEqual('#FF000080');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(120)).toEqual(undefined);
});

test('getColorFunction with operator undefined', () => {
  const colorFunction = getColorFunction(
    {
      operator: undefined,
      targetValue: 150,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction with colorScheme undefined', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 150,
      colorScheme: undefined,
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFunction BeginsWith', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.BeginsWith,
      targetValue: 'C',
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Brian')).toBeUndefined();
  expect(colorFunction('Carlos')).toEqual('#FF0000FF');
});

test('getColorFunction EndsWith', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.EndsWith,
      targetValue: 'n',
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Carlos')).toBeUndefined();
  expect(colorFunction('Brian')).toEqual('#FF0000FF');
});

test('getColorFunction Containing', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Containing,
      targetValue: 'o',
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Diana')).toBeUndefined();
  expect(colorFunction('Carlos')).toEqual('#FF0000FF');
});

test('getColorFunction NotContaining', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.NotContaining,
      targetValue: 'i',
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Diana')).toBeUndefined();
  expect(colorFunction('Carlos')).toEqual('#FF0000FF');
});

test('getColorFunction Equal', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.Equal,
      targetValue: 'Diana',
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Carlos')).toBeUndefined();
  expect(colorFunction('Diana')).toEqual('#FF0000FF');
});

test('getColorFunction None', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Diana')).toEqual('#FF0000FF');
  expect(colorFunction('Carlos')).toEqual('#FF0000FF');
  expect(colorFunction('Brian')).toEqual('#FF0000FF');
});

test('getColorFunction IsTrue', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsTrue,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(true)).toEqual('#FF0000FF');
  expect(colorFunction(false)).toBeUndefined();
  expect(colorFunction(null)).toBeUndefined();
});

test('getColorFunction IsFalse', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsFalse,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(true)).toBeUndefined();
  expect(colorFunction(false)).toEqual('#FF0000FF');
  expect(colorFunction(null)).toBeUndefined();
});

test('getColorFunction IsNull', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(true)).toBeUndefined();
  expect(colorFunction(false)).toBeUndefined();
  expect(colorFunction(null)).toEqual('#FF0000FF');
});

test('getColorFunction IsNotNull', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsNotNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(true)).toEqual('#FF0000FF');
  expect(colorFunction(false)).toEqual('#FF0000FF');
  expect(colorFunction(null)).toBeUndefined();
});

test('getColorFunction IsNotNull returns undefined for non-boolean value', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsNotNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(50 as unknown as boolean)).toBeUndefined();
});

test('getColorFunction returns undefined for null values on numeric comparators', () => {
  const operators = [
    { operator: Comparator.LessThan, targetValue: 50 },
    { operator: Comparator.LessOrEqual, targetValue: 50 },
    { operator: Comparator.GreaterThan, targetValue: 50 },
    { operator: Comparator.GreaterOrEqual, targetValue: 50 },
    { operator: Comparator.Equal, targetValue: 50 },
    { operator: Comparator.NotEqual, targetValue: 50 },
  ];
  operators.forEach(({ operator, targetValue }) => {
    const colorFunction = getColorFunction(
      {
        operator,
        targetValue,
        colorScheme: '#FF0000',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(null)).toBeUndefined();
    expect(colorFunction(undefined as unknown as null)).toBeUndefined();
  });
});

test('getColorFunction returns undefined for null values on Between comparators', () => {
  const operators = [
    Comparator.Between,
    Comparator.BetweenOrEqual,
    Comparator.BetweenOrLeftEqual,
    Comparator.BetweenOrRightEqual,
  ];
  operators.forEach(operator => {
    const colorFunction = getColorFunction(
      {
        operator,
        targetValueLeft: -10,
        targetValueRight: 50,
        colorScheme: '#FF0000',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(null)).toBeUndefined();
    expect(colorFunction(undefined as unknown as null)).toBeUndefined();
  });
});

test('getColorFunction returns undefined for null values on None operator', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(null)).toBeUndefined();
  expect(colorFunction(undefined as unknown as null)).toBeUndefined();
});

test('getColorFunction returns undefined for null values on string comparators', () => {
  const operators = [
    Comparator.BeginsWith,
    Comparator.EndsWith,
    Comparator.Containing,
    Comparator.NotContaining,
  ];
  operators.forEach(operator => {
    const colorFunction = getColorFunction(
      {
        operator,
        targetValue: 'test',
        colorScheme: '#FF0000',
        column: 'name',
      },
      strValues,
    );
    expect(colorFunction(null)).toBeUndefined();
    expect(colorFunction(undefined as unknown as null)).toBeUndefined();
  });
});

test('getColorFunction returns undefined for empty and whitespace string values', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessThan,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction('' as unknown as number)).toBeUndefined();
  expect(colorFunction('  ' as unknown as number)).toBeUndefined();
  expect(colorFunction('\t' as unknown as number)).toBeUndefined();
});

test('getColorFunction IsNull still matches null values', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.IsNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    boolValues,
  );
  expect(colorFunction(null)).toEqual('#FF0000FF');
  expect(colorFunction(true)).toBeUndefined();
});

test('correct column config', () => {
  const columnConfig = [
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
    },
    {
      operator: Comparator.LessThan,
      targetValue: 300,
      colorScheme: '#FF0000',
      column: 'sum',
    },
    {
      operator: Comparator.Between,
      targetValueLeft: 75,
      targetValueRight: 125,
      colorScheme: '#FF0000',
      column: 'count',
    },
    {
      operator: Comparator.GreaterThan,
      targetValue: 150,
      colorScheme: '#FF0000',
      column: undefined,
    },
  ];
  const colorFormatters = getColorFormatters(columnConfig, mockData);
  expect(colorFormatters.length).toEqual(3);

  expect(colorFormatters[0].column).toEqual('count');
  expect(colorFormatters[0].getColorFromValue(100)).toEqual('#FF0000FF');

  expect(colorFormatters[1].column).toEqual('sum');
  expect(colorFormatters[1].getColorFromValue(200)).toEqual('#FF0000FF');
  expect(colorFormatters[1].getColorFromValue(400)).toBeUndefined();

  expect(colorFormatters[2].column).toEqual('count');
  expect(colorFormatters[2].getColorFromValue(100)).toEqual('#FF000087');
});

test('getColorFormatters falls back to automatic bounds for saved percentage rules when requested', () => {
  const colorFormatters = getColorFormatters(
    [
      {
        operator: Comparator.None,
        colorScheme: '#FF0000',
        column: 'count',
        useGradient: true,
        boundUnit: BoundUnit.Percent,
        minBound: 0,
        maxBound: 200,
      },
      {
        operator: Comparator.None,
        colorScheme: '#00FF00',
        column: 'sum',
        boundUnit: BoundUnit.Value,
      },
    ],
    mockData,
    undefined,
    undefined,
    true,
  );

  expect(colorFormatters).toHaveLength(2);
  expect(colorFormatters[0].column).toBe('count');
  expect(colorFormatters[0].getColorFromValue(50)).toEqual('#FF000000');
  expect(colorFormatters[0].getColorFromValue(100)).toEqual('#FF0000FF');
  expect(colorFormatters[1].column).toBe('sum');
});

test('undefined column config', () => {
  const colorFormatters = getColorFormatters(undefined, mockData);
  expect(colorFormatters.length).toEqual(0);
});

test('correct column string config', () => {
  const columnConfigString = [
    {
      operator: Comparator.BeginsWith,
      targetValue: 'D',
      colorScheme: '#FF0000',
      column: 'name',
    },
    {
      operator: Comparator.EndsWith,
      targetValue: 'n',
      colorScheme: '#FF0000',
      column: 'name',
    },
    {
      operator: Comparator.Containing,
      targetValue: 'o',
      colorScheme: '#FF0000',
      column: 'name',
    },
    {
      operator: Comparator.NotContaining,
      targetValue: 'i',
      colorScheme: '#FF0000',
      column: 'name',
    },
  ];
  const colorFormatters = getColorFormatters(columnConfigString, strData);
  expect(colorFormatters.length).toEqual(4);

  expect(colorFormatters[0].column).toEqual('name');
  expect(colorFormatters[0].getColorFromValue('Diana')).toEqual('#FF0000FF');

  expect(colorFormatters[1].column).toEqual('name');
  expect(colorFormatters[1].getColorFromValue('Brian')).toEqual('#FF0000FF');

  expect(colorFormatters[2].column).toEqual('name');
  expect(colorFormatters[2].getColorFromValue('Carlos')).toEqual('#FF0000FF');

  expect(colorFormatters[3].column).toEqual('name');
  expect(colorFormatters[3].getColorFromValue('Carlos')).toEqual('#FF0000FF');
});

test('getColorFunction with useGradient false returns solid color', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterOrEqual,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
      useGradient: false,
    },
    countValues,
  );
  // When useGradient is false, should return solid color without opacity
  expect(colorFunction(50)).toEqual('#FF0000');
  expect(colorFunction(100)).toEqual('#FF0000');
  expect(colorFunction(0)).toBeUndefined();
});

test('getColorFunction with useGradient true returns gradient color', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterOrEqual,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
      useGradient: true,
    },
    countValues,
  );
  // When useGradient is true, should return gradient color with opacity
  expect(colorFunction(50)).toEqual('#FF00000D');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(0)).toBeUndefined();
});

test('getColorFunction with useGradient undefined defaults to gradient (backward compatibility)', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterOrEqual,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
      // useGradient is undefined
    },
    countValues,
  );
  // When useGradient is undefined, should default to gradient for backward compatibility
  expect(colorFunction(50)).toEqual('#FF00000D');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(0)).toBeUndefined();
});

test('getColorFunction with useGradient false and None operator returns solid color', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      useGradient: false,
    },
    countValues,
  );
  // When useGradient is false, all matching values should return solid color
  expect(colorFunction(20)).toBeUndefined();
  expect(colorFunction(50)).toEqual('#FF0000');
  expect(colorFunction(75)).toEqual('#FF0000');
  expect(colorFunction(100)).toEqual('#FF0000');
  expect(colorFunction(120)).toBeUndefined();
});

test('getColorFormatters with useGradient flag', () => {
  const columnConfig = [
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF0000',
      column: 'count',
      useGradient: false,
    },
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#00FF00',
      column: 'count',
      useGradient: true,
    },
  ];
  const colorFormatters = getColorFormatters(columnConfig, mockData);
  expect(colorFormatters.length).toEqual(2);

  // First formatter with useGradient: false should return solid color
  expect(colorFormatters[0].column).toEqual('count');
  expect(colorFormatters[0].getColorFromValue(100)).toEqual('#FF0000');

  // Second formatter with useGradient: true should return gradient color
  expect(colorFormatters[1].column).toEqual('count');
  expect(colorFormatters[1].getColorFromValue(100)).toEqual('#00FF00FF');
});

test('getColorFunction NOT_EQUAL returns undefined when targetValue is non-numeric', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.NotEqual,
      targetValue: 'not-a-number' as unknown as number,
      colorScheme: '#FF0000',
      column: 'count',
    },
    countValues,
  );
  expect(colorFunction(50)).toBeUndefined();
  expect(colorFunction(100)).toBeUndefined();
});

test('getColorFormatters resolves colorScheme from theme when it starts with "color"', () => {
  const theme = { colorPrimary: '#AABBCC' };
  const columnConfig = [
    {
      operator: Comparator.None,
      colorScheme: 'colorPrimary',
      column: 'count',
    },
  ];
  const colorFormatters = getColorFormatters(columnConfig, mockData, theme);
  expect(colorFormatters).toHaveLength(1);
  expect(colorFormatters[0].getColorFromValue(75)).toContain('#AABBCC');
});

test('correct column boolean config', () => {
  const columnConfigBoolean = [
    {
      operator: Comparator.IsTrue,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    {
      operator: Comparator.IsFalse,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    {
      operator: Comparator.IsNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
    {
      operator: Comparator.IsNotNull,
      targetValue: '',
      colorScheme: '#FF0000',
      column: 'isMember',
    },
  ];
  const colorFormatters = getColorFormatters(columnConfigBoolean, boolData);
  expect(colorFormatters.length).toEqual(4);

  expect(colorFormatters[0].column).toEqual('isMember');
  expect(colorFormatters[0].getColorFromValue(true)).toEqual('#FF0000FF');

  expect(colorFormatters[1].column).toEqual('isMember');
  expect(colorFormatters[1].getColorFromValue(false)).toEqual('#FF0000FF');

  expect(colorFormatters[2].column).toEqual('isMember');
  expect(colorFormatters[2].getColorFromValue(null)).toEqual('#FF0000FF');

  expect(colorFormatters[3].column).toEqual('isMember');
  expect(colorFormatters[3].getColorFromValue(true)).toEqual('#FF0000FF');
  expect(colorFormatters[3].getColorFromValue(false)).toEqual('#FF0000FF');
});

test('should return hex color when colorScheme is an RGB object', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: { r: 255, g: 128, b: 0, a: 1 },
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Diana')).toEqual('#ff8000');
  expect(colorFunction('Carlos')).toEqual('#ff8000');
  expect(colorFunction('Brian')).toEqual('#ff8000');
});

test('should return token name as-is when colorScheme is a string token', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: 'Green',
      column: 'name',
    },
    strValues,
  );
  expect(colorFunction('Diana')).toEqual('Green');
  expect(colorFunction('Carlos')).toEqual('Green');
  expect(colorFunction('Brian')).toEqual('Green');
});

test('should return solid hex color when useGradient is false or true', () => {
  const columnConfig = [
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: { r: 0, g: 47, b: 255, a: 1 },
      column: 'count',
      useGradient: false,
    },
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: { r: 255, g: 166, b: 0, a: 1 },
      column: 'count',
      useGradient: true,
    },
  ];
  const colorFormatters = getColorFormatters(columnConfig, mockData);
  expect(colorFormatters.length).toEqual(2);

  // First formatter with useGradient: false should return solid color
  expect(colorFormatters[0].column).toEqual('count');
  expect(colorFormatters[0].getColorFromValue(100)).toEqual('#002fff');

  // Second formatter with useGradient: true should return gradient color
  expect(colorFormatters[1].column).toEqual('count');
  expect(colorFormatters[1].getColorFromValue(100)).toEqual('#ffa600FF');
});

test('should return hex color without alpha for GreaterThan operator with RGB colorScheme', () => {
  const config = {
    operator: Comparator.GreaterThan,
    targetValue: 50,
    colorScheme: { r: 255, g: 0, b: 0, a: 1 },
    useGradient: true,
  };

  const columnValues = [10, 50, 100];

  const alpha = false;
  const colorFunction = getColorFunction(config, columnValues, alpha);

  expect(colorFunction(100)).toEqual('#ff0000');
});

test('should preserve alpha from colorScheme when useGradient is false', () => {
  const config = {
    operator: Comparator.None,
    colorScheme: { r: 255, g: 0, b: 0, a: 0.5 },
    useGradient: false,
  };

  const colorFunction = getColorFunction(config, [10, 20, 30]);
  const result = colorFunction(20);

  expect(result).not.toBe('#ff0000');
  expect(result).not.toBe('rgb(255, 0, 0)');
});

test('should force opaque color when useGradient is false but alpha is explicitly false', () => {
  const config = {
    operator: Comparator.None,
    colorScheme: { r: 255, g: 0, b: 0, a: 0.5 },
    useGradient: false,
  };

  const colorFunction = getColorFunction(config, [10, 20, 30], false);
  const result = colorFunction(20);

  expect(result).toBe('#ff0000');
});

test('should return colorScheme as-is when alpha is false and length is 7', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF0000',
      useGradient: false,
      column: 'count',
    },
    countValues,
    false,
  );

  expect(colorFunction(100)).toEqual('#FF0000');
});

test('should preserve alpha when alpha is undefined and colorScheme has 9 chars', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF000080',
      useGradient: false,
      column: 'count',
    },
    countValues,
  );

  expect(colorFunction(100)).toEqual('#FF000080');
});

test('should preserve alpha when alpha is true and colorScheme has 9 chars', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF000080',
      useGradient: false,
      column: 'count',
    },
    countValues,
    true,
  );

  expect(colorFunction(100)).toEqual('#FF000080');
});

test('should strip alpha channel when alpha is false and colorScheme has 9 chars', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF000080',
      useGradient: false,
      column: 'count',
    },
    countValues,
    false,
  );

  expect(colorFunction(100)).toEqual('#FF0000');
  expect(colorFunction(100)).toHaveLength(7);
});

test('should discard the fixed alpha of a 9-char colorScheme before applying gradient opacity', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 50,
      colorScheme: '#FF000080',
      useGradient: true,
      column: 'count',
    },
    countValues,
  );

  expect(colorFunction(75)).toEqual('#FF000087');
});

test('getColorFunction GREATER_THAN respects manual maxBound', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 0,
      maxBound: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [25, 50],
  );
  expect(colorFunction(0)).toBeUndefined();
  expect(colorFunction(50)).toEqual('#FF000087');
  expect(colorFunction(100)).toEqual('#FF0000FF');
  expect(colorFunction(150)).toEqual('#FF0000FF');
});

test('getColorFunction GREATER_THAN ignores a maxBound below its target', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 100,
      maxBound: 90,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [100, 150],
  );
  expect(colorFunction(125)).toEqual('#FF000087');
  expect(colorFunction(150)).toEqual('#FF0000FF');
});

test('getColorFunction LESS_THAN respects manual minBound', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessThan,
      targetValue: 100,
      minBound: 0,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [50, 75],
  );
  expect(colorFunction(100)).toBeUndefined();
  expect(colorFunction(50)).toEqual('#FF000087');
  expect(colorFunction(0)).toEqual('#FF0000FF');
  expect(colorFunction(-50)).toEqual('#FF0000FF');
});

test('getColorFunction LESS_THAN ignores a minBound above its target', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessThan,
      targetValue: 100,
      minBound: 110,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [50, 100],
  );
  expect(colorFunction(75)).toEqual('#FF000087');
  expect(colorFunction(50)).toEqual('#FF0000FF');
});

test('getColorFunction GREATER_OR_EQUAL respects manual maxBound', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterOrEqual,
      targetValue: 0,
      maxBound: 100,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [25, 50],
  );
  expect(colorFunction(-10)).toBeUndefined();
  expect(colorFunction(0)).toEqual('#FF00000D');
  expect(colorFunction(50)).toEqual('#FF000087');
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction LESS_OR_EQUAL respects manual minBound', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.LessOrEqual,
      targetValue: 100,
      minBound: 0,
      colorScheme: '#FF0000',
      column: 'count',
    },
    [50, 75],
  );
  expect(colorFunction(150)).toBeUndefined();
  expect(colorFunction(100)).toEqual('#FF00000D');
  expect(colorFunction(50)).toEqual('#FF000087');
  expect(colorFunction(0)).toEqual('#FF0000FF');
});

test('getColorFunction NONE respects manual minBound and maxBound', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      minBound: 0,
      maxBound: 200,
    },
    countValues,
  );
  expect(colorFunction(-10)).toEqual('#FF000000');
  expect(colorFunction(0)).toEqual('#FF000000');
  expect(colorFunction(100)).toEqual('#FF000080');
  expect(colorFunction(200)).toEqual('#FF0000FF');
  expect(colorFunction(250)).toEqual('#FF0000FF');
});

test('getColorFunction NONE applies a diverging low/mid/high scale when centerValue and all three colors are set', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#000000',
      column: 'count',
      minBound: 0,
      maxBound: 100,
      centerValue: 50,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      midColor: { r: 255, g: 255, b: 255, a: 1 },
      highColor: { r: 0, g: 128, b: 0, a: 1 },
    },
    [10, 90],
  );
  expect(colorFunction(0)).toEqual('#ff0000');
  expect(colorFunction(25)).toEqual('#ff8080');
  expect(colorFunction(50)).toEqual('#ffffff');
  expect(colorFunction(75)).toEqual('#80c080');
  expect(colorFunction(100)).toEqual('#008000');
});

test('getColorFunction NONE uses the solid base color when gradient is disabled for a complete diverging config', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#000000',
      useGradient: false,
      column: 'count',
      minBound: 0,
      maxBound: 100,
      centerValue: 50,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      midColor: { r: 255, g: 255, b: 255, a: 1 },
      highColor: { r: 0, g: 128, b: 0, a: 1 },
    },
    [10, 90],
  );

  expect(colorFunction(25)).toEqual('#000000');
  expect(colorFunction(75)).toEqual('#000000');
});

test('getColorFunction NONE ignores an incomplete diverging config and falls back to colorScheme', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      minBound: 0,
      maxBound: 100,
      centerValue: 50,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      // midColor and highColor intentionally omitted
    },
    [10, 90],
  );
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction NONE ignores a centerValue outside the min/max range', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      minBound: 0,
      maxBound: 100,
      centerValue: 150,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      midColor: { r: 255, g: 255, b: 255, a: 1 },
      highColor: { r: 0, g: 128, b: 0, a: 1 },
    },
    [10, 90],
  );
  expect(colorFunction(100)).toEqual('#FF0000FF');
});

test('getColorFunction NONE resolves percent bounds against column sum', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Sum,
      minBound: 0,
      maxBound: 100,
    },
    [50, 150],
  );
  // sum = 200, so minBound 0% -> 0, maxBound 100% -> 200 -- the same absolute
  // range as the existing 'NONE respects manual minBound and maxBound' test
  // above, just reached via percent-of-sum instead of typed directly.
  expect(colorFunction(-10)).toEqual('#FF000000');
  expect(colorFunction(0)).toEqual('#FF000000');
  expect(colorFunction(100)).toEqual('#FF000080');
  expect(colorFunction(200)).toEqual('#FF0000FF');
  expect(colorFunction(250)).toEqual('#FF0000FF');
});

test('getColorFunction NONE resolves percent bounds against column max', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Max,
      minBound: 0,
      maxBound: 100,
    },
    [10, 40, 90],
  );
  // max = 90, so maxBound 100% -> 90.
  expect(colorFunction(0)).toEqual('#FF000000');
  expect(colorFunction(45)).toEqual('#FF000080');
  expect(colorFunction(90)).toEqual('#FF0000FF');
});

test('getColorFunction NONE defaults percentDenominator to column max when unset', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      minBound: 0,
      maxBound: 100,
    },
    [10, 40, 90],
  );
  expect(colorFunction(45)).toEqual('#FF000080');
  expect(colorFunction(90)).toEqual('#FF0000FF');
});

test('getColorFunction NONE ignores percentDenominator and treats bounds as absolute when boundUnit is unset', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      percentDenominator: PercentDenominator.Sum,
      minBound: 0,
      maxBound: 200,
    },
    [50, 150],
  );
  // percentDenominator is present but boundUnit is not 'percent', so minBound
  // and maxBound are used exactly as typed rather than resolved against the
  // sum.
  expect(colorFunction(100)).toEqual('#FF000080');
  expect(colorFunction(200)).toEqual('#FF0000FF');
});

test('getColorFunction NONE applies a percent-resolved centerValue to the diverging scale', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#000000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Max,
      minBound: 0,
      maxBound: 100,
      centerValue: 50,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      midColor: { r: 255, g: 255, b: 255, a: 1 },
      highColor: { r: 0, g: 128, b: 0, a: 1 },
    },
    [0, 100],
  );
  // max = 100, so every bound resolves to exactly the value it names. This
  // verifies that boundUnit and percentDenominator also apply to centerValue.
  expect(colorFunction(0)).toEqual('#ff0000');
  expect(colorFunction(50)).toEqual('#ffffff');
  expect(colorFunction(100)).toEqual('#008000');
});

test('getColorFunction NONE degrades percent bounds to unset when the column has no numeric values', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Sum,
      minBound: 0,
      maxBound: 100,
    },
    [],
  );
  // No numeric values to sum -> both bounds resolve to unset -> the None
  // branch's own no-manual-bound path runs Math.min/Math.max on an empty
  // array (Infinity/-Infinity), so cutoffValue > extremeValue and every
  // value is rejected -- the same degrade-safe "no coloring" outcome Phase
  // 1/2 use elsewhere for invalid config shapes.
  expect(colorFunction(0)).toBeUndefined();
  expect(colorFunction(50)).toBeUndefined();
});

test('getColorFunction NONE falls back to automatic bounds for a non-positive column max', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Max,
      minBound: 0,
      maxBound: 100,
    },
    [-100, -5],
  );
  // A negative denominator would reverse the configured 0%-100% bounds.
  // Treating both as unset preserves an ordered, data-derived range.
  expect(colorFunction(-100)).toEqual('#FF000000');
  expect(colorFunction(-5)).toEqual('#FF0000FF');
});

test('getColorFunction NONE uses the sum of magnitudes for mixed-sign values', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Sum,
      minBound: 0,
      maxBound: 100,
    },
    [500, -499, 400, -400],
  );
  // The signed sum is 1, but the magnitude sum is 1799. Using the signed sum
  // would make every positive value saturate at the upper endpoint.
  expect(colorFunction(-400)).toEqual('#FF000000');
  expect(colorFunction(0)).toEqual('#FF000000');
  expect(colorFunction(899.5)).toEqual('#FF000080');
  expect(colorFunction(1799)).toEqual('#FF0000FF');
});

test('getColorFunction NONE keeps the running column max when a later value is smaller', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.None,
      colorScheme: '#FF0000',
      column: 'count',
      boundUnit: BoundUnit.Percent,
      percentDenominator: PercentDenominator.Max,
      minBound: 0,
      maxBound: 100,
    },
    [90, 10, 40],
  );
  // max = 90 regardless of position in the array, so maxBound 100% -> 90.
  expect(colorFunction(45)).toEqual('#FF000080');
  expect(colorFunction(90)).toEqual('#FF0000FF');
});

test('getColorFunction GREATER_THAN ignores diverging fields even when fully set', () => {
  const colorFunction = getColorFunction(
    {
      operator: Comparator.GreaterThan,
      targetValue: 0,
      colorScheme: '#FF0000',
      column: 'count',
      centerValue: 50,
      lowColor: { r: 255, g: 0, b: 0, a: 1 },
      midColor: { r: 255, g: 255, b: 255, a: 1 },
      highColor: { r: 0, g: 128, b: 0, a: 1 },
    },
    [25, 100],
  );
  expect(colorFunction(100)).toEqual('#FF0000FF');
});
