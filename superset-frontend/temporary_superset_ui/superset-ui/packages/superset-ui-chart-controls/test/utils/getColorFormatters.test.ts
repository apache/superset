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
  COMPARATOR,
  getOpacity,
  rgbToRgba,
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
    expect(getOpacity(75, 50, 100)).toEqual(0.65);
    expect(getOpacity(75, 100, 50)).toEqual(0.65);
    expect(getOpacity(100, 100, 50)).toEqual(0.3);
  });
});

describe('rgba', () => {
  it('returns correct rgba value', () => {
    expect(rgbToRgba('rgb(255,0,0)', 0.5)).toEqual('rgba(255,0,0,0.5)');
  });
});

describe('getColorFunction()', () => {
  it('getColorFunction GREATER_THAN', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.GREATER_THAN,
        targetValue: 50,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
  });

  it('getColorFunction LESS_THAN', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.LESS_THAN,
        targetValue: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(100)).toBeUndefined();
    expect(colorFunction(50)).toEqual('rgba(255,0,0,1)');
  });

  it('getColorFunction GREATER_OR_EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.GREATER_OR_EQUAL,
        targetValue: 50,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toEqual('rgba(255,0,0,0.3)');
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
    expect(colorFunction(0)).toBeUndefined();
  });

  it('getColorFunction LESS_OR_EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.LESS_OR_EQUAL,
        targetValue: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toEqual('rgba(255,0,0,1)');
    expect(colorFunction(100)).toEqual('rgba(255,0,0,0.3)');
    expect(colorFunction(150)).toBeUndefined();
  });

  it('getColorFunction EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.EQUAL,
        targetValue: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
  });

  it('getColorFunction NOT_EQUAL', () => {
    let colorFunction = getColorFunction(
      {
        operator: COMPARATOR.NOT_EQUAL,
        targetValue: 60,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(60)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
    expect(colorFunction(50)).toEqual('rgba(255,0,0,0.48)');

    colorFunction = getColorFunction(
      {
        operator: COMPARATOR.NOT_EQUAL,
        targetValue: 90,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(90)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,0.48)');
    expect(colorFunction(50)).toEqual('rgba(255,0,0,1)');
  });

  it('getColorFunction BETWEEN', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.BETWEEN,
        targetValueLeft: 75,
        targetValueRight: 125,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,0.65)');
  });

  it('getColorFunction BETWEEN_OR_EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.BETWEEN_OR_EQUAL,
        targetValueLeft: 50,
        targetValueRight: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toEqual('rgba(255,0,0,0.3)');
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
    expect(colorFunction(150)).toBeUndefined();
  });

  it('getColorFunction BETWEEN_OR_LEFT_EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
        targetValueLeft: 50,
        targetValueRight: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toEqual('rgba(255,0,0,0.3)');
    expect(colorFunction(100)).toBeUndefined();
  });

  it('getColorFunction BETWEEN_OR_RIGHT_EQUAL', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
        targetValueLeft: 50,
        targetValueRight: 100,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toBeUndefined();
    expect(colorFunction(100)).toEqual('rgba(255,0,0,1)');
  });

  it('getColorFunction GREATER_THAN with target value undefined', () => {
    const colorFunction = getColorFunction(
      {
        operator: COMPARATOR.GREATER_THAN,
        targetValue: undefined,
        colorScheme: 'rgb(255,0,0)',
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
        operator: COMPARATOR.BETWEEN,
        targetValueLeft: undefined,
        targetValueRight: 100,
        colorScheme: 'rgb(255,0,0)',
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
        operator: COMPARATOR.BETWEEN,
        targetValueLeft: 50,
        targetValueRight: undefined,
        colorScheme: 'rgb(255,0,0)',
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
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      countValues,
    );
    expect(colorFunction(50)).toBeUndefined();
    expect(colorFunction(100)).toBeUndefined();
  });

  it('getColorFunction with operator undefined', () => {
    const colorFunction = getColorFunction(
      {
        operator: undefined,
        targetValue: 150,
        colorScheme: 'rgb(255,0,0)',
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
        operator: COMPARATOR.GREATER_THAN,
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
        operator: COMPARATOR.GREATER_THAN,
        targetValue: 50,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      {
        operator: COMPARATOR.LESS_THAN,
        targetValue: 300,
        colorScheme: 'rgb(255,0,0)',
        column: 'sum',
      },
      {
        operator: COMPARATOR.BETWEEN,
        targetValueLeft: 75,
        targetValueRight: 125,
        colorScheme: 'rgb(255,0,0)',
        column: 'count',
      },
      {
        operator: COMPARATOR.GREATER_THAN,
        targetValue: 150,
        colorScheme: 'rgb(255,0,0)',
        column: undefined,
      },
    ];
    const colorFormatters = getColorFormatters(columnConfig, mockData);
    expect(colorFormatters.length).toEqual(3);

    expect(colorFormatters[0].column).toEqual('count');
    expect(colorFormatters[0].getColorFromValue(100)).toEqual('rgba(255,0,0,1)');

    expect(colorFormatters[1].column).toEqual('sum');
    expect(colorFormatters[1].getColorFromValue(200)).toEqual('rgba(255,0,0,1)');
    expect(colorFormatters[1].getColorFromValue(400)).toBeUndefined();

    expect(colorFormatters[2].column).toEqual('count');
    expect(colorFormatters[2].getColorFromValue(100)).toEqual('rgba(255,0,0,0.65)');
  });

  it('undefined column config', () => {
    const colorFormatters = getColorFormatters(undefined, mockData);
    expect(colorFormatters.length).toEqual(0);
  });
});
