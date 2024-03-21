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
import { configure } from '@superset-ui/core';
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

describe('round', () => {
  it('round', () => {
    expect(round(1)).toEqual(1);
    expect(round(1, 2)).toEqual(1);
    expect(round(0.6)).toEqual(1);
    expect(round(0.6, 1)).toEqual(0.6);
    expect(round(0.64999, 2)).toEqual(0.65);
  });
});

describe('getOpacity', () => {
  it('getOpacity', () => {
    expect(getOpacity(100, 100, 100)).toEqual(1);
    expect(getOpacity(75, 50, 100)).toEqual(0.53);
    expect(getOpacity(75, 100, 50)).toEqual(0.53);
    expect(getOpacity(100, 100, 50)).toEqual(0.05);
    expect(getOpacity(100, 100, 100, 0, 0.8)).toEqual(0.8);
    expect(getOpacity(100, 100, 50, 0, 1)).toEqual(0);
    expect(getOpacity(999, 100, 50, 0, 1)).toEqual(1);
    expect(getOpacity(100, 100, 50, 0.99, 1)).toEqual(0.99);
    expect(getOpacity(99, 100, 50, 0, 1)).toEqual(0.02);
  });
});

describe('getColorFunction()', () => {
  it('getColorFunction GREATER_THAN', () => {
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

  it('getColorFunction LESS_THAN', () => {
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

  it('getColorFunction GREATER_OR_EQUAL', () => {
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

  it('getColorFunction LESS_OR_EQUAL', () => {
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

  it('getColorFunction EQUAL', () => {
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

  it('getColorFunction NOT_EQUAL', () => {
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

  it('getColorFunction BETWEEN', () => {
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

  it('getColorFunction BETWEEN_OR_EQUAL', () => {
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

  it('getColorFunction BETWEEN_OR_EQUAL without opacity', () => {
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

  it('getColorFunction BETWEEN_OR_LEFT_EQUAL', () => {
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

  it('getColorFunction BETWEEN_OR_RIGHT_EQUAL', () => {
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

  it('getColorFunction GREATER_THAN with target value undefined', () => {
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

  it('getColorFunction BETWEEN with target value left undefined', () => {
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

  it('getColorFunction BETWEEN with target value right undefined', () => {
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

  it('getColorFunction unsupported operator', () => {
    const colorFunction = getColorFunction(
      {
        // @ts-ignore
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

  it('getColorFunction with operator None', () => {
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

  it('getColorFunction with operator undefined', () => {
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

  it('getColorFunction with colorScheme undefined', () => {
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
});

describe('getColorFormatters()', () => {
  it('correct column config', () => {
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

  it('undefined column config', () => {
    const colorFormatters = getColorFormatters(undefined, mockData);
    expect(colorFormatters.length).toEqual(0);
  });
});
