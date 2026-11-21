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
import { getColorFunction } from '../../src/utils/getColorFormatters';
import { Comparator, ConditionalFormattingConfig } from '../../src/types';

// Regression guard for #36098: bounded-range conditional formatting operators
// must render a gradient (opacity proportional to where the value falls in the
// range), not a flat color, when "Use gradient" is on.
const VALUES = [1, 10, 30, 50, 60];
const BOUNDED_OPERATORS = [
  Comparator.Between, // < x <
  Comparator.BetweenOrEqual, // <= x <=
  Comparator.BetweenOrLeftEqual, // <= x <
  Comparator.BetweenOrRightEqual, // < x <=
];

test.each(BOUNDED_OPERATORS)(
  'bounded operator %s renders a gradient across the range',
  operator => {
    const config: ConditionalFormattingConfig = {
      operator,
      targetValueLeft: 1,
      targetValueRight: 60,
      colorScheme: '#FF0000',
      useGradient: true,
    };
    const fn = getColorFunction(config, VALUES);
    // All three must be distinct, so it's a real gradient, not a flat fill.
    expect(new Set([fn(10), fn(30), fn(50)]).size).toBe(3);
  },
);

test('bounded operator renders a gradient with string-typed bounds (form inputs)', () => {
  // Form inputs can deliver the bounds as strings at runtime, even though the
  // config type declares them as numbers.
  const config = {
    operator: Comparator.Between,
    targetValueLeft: '1',
    targetValueRight: '60',
    colorScheme: '#FF0000',
    useGradient: true,
  } as unknown as ConditionalFormattingConfig;
  const fn = getColorFunction(config, VALUES);
  expect(new Set([fn(10), fn(30), fn(50)]).size).toBe(3);
});

test('useGradient=false produces a solid color for bounded operators', () => {
  const config: ConditionalFormattingConfig = {
    operator: Comparator.Between,
    targetValueLeft: 1,
    targetValueRight: 60,
    colorScheme: '#FF0000',
    useGradient: false,
  };
  const fn = getColorFunction(config, VALUES);
  expect(fn(10)).toEqual(fn(50));
  expect(fn(30)).toEqual('#FF0000');
});
