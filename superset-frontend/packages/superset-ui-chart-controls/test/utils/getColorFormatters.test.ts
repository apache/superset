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
import { configure } from '@apache-superset/core';
import {
  Comparator,
  getOpacity,
  round,
  getColorFormatters,
  getColorFunction,
} from '../../src';

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
