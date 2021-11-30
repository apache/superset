/*
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
  evalExpression,
  isValidExpression,
} from '@superset-ui/core/src/math-expression';

test('evalExpression evaluates constants correctly', () => {
  expect(evalExpression('0', 10)).toEqual(0);
  expect(evalExpression('0.123456', 0)).toEqual(0.123456);
  expect(evalExpression('789', 100)).toEqual(789);
});

test('evalExpression evaluates infinities correctly', () => {
  const formula = 'x/0';
  expect(evalExpression(formula, 1)).toEqual(Infinity);
  expect(evalExpression(formula, -1)).toEqual(-Infinity);
});

test('evalExpression evaluates powers correctly', () => {
  const formula = '2^(x/2)*100';
  expect(evalExpression(formula, 0)).toEqual(100);
  expect(evalExpression(formula, 1)).toEqual(141.4213562373095);
  expect(evalExpression(formula, 2)).toEqual(200);
});

test('evalExpression ignores whitespace and variables on left hand side of equals sign', () => {
  expect(evalExpression('y=x+1', 1)).toEqual(2);
  expect(evalExpression('y = x    - 1', 1)).toEqual(0);
});

test('evalExpression evaluates custom operators correctly', () => {
  const equalsExpression = 'x == 10';
  expect(evalExpression(equalsExpression, 5)).toEqual(0);
  expect(evalExpression(equalsExpression, 10)).toEqual(1);
  expect(evalExpression(equalsExpression, 10.1)).toEqual(0);

  const closedRange = '(x > 0) and (x < 10)';
  expect(evalExpression(closedRange, 0)).toEqual(0);
  expect(evalExpression(closedRange, 5)).toEqual(1);
  expect(evalExpression(closedRange, 10)).toEqual(0);

  const openRange = '(x >= 0) and (x <= 10)';
  expect(evalExpression(openRange, -0.1)).toEqual(0);
  expect(evalExpression(openRange, 0)).toEqual(1);
  expect(evalExpression(openRange, 5)).toEqual(1);
  expect(evalExpression(openRange, 10)).toEqual(1);
  expect(evalExpression(openRange, 10.1)).toEqual(0);

  const orRange = '(x < 0) or (x > 10)';
  expect(evalExpression(orRange, -0.1)).toEqual(1);
  expect(evalExpression(orRange, 0)).toEqual(0);
  expect(evalExpression(orRange, 5)).toEqual(0);
  expect(evalExpression(orRange, 10)).toEqual(0);
  expect(evalExpression(orRange, 10.1)).toEqual(1);

  // other less used operators
  expect(evalExpression('5 & x', 3)).toEqual(1);
  expect(evalExpression('5 | x', 3)).toEqual(7);
  expect(evalExpression('5 xor x', 2)).toEqual(7);

  // complex combinations
  const complexExpression =
    '20.51*(x<1577836800000)+20.2((x<15805152000000)&(x>=1577836800000))';
  expect(evalExpression(complexExpression, 0)).toEqual(20.51);
  expect(evalExpression(complexExpression, 1000)).toEqual(20.51);
  expect(evalExpression(complexExpression, 1577836800000)).toEqual(20.2);
  expect(evalExpression(complexExpression, 15805151999999)).toEqual(20.2);
  expect(evalExpression(complexExpression, 15805152000000)).toEqual(0);
  expect(evalExpression(complexExpression, 15805159000000)).toEqual(0);
});

test('isValidExpression correctly identifies invalid formulas', () => {
  expect(isValidExpression('foobar')).toEqual(false);
  expect(isValidExpression('x+')).toEqual(false);
  expect(isValidExpression('z+1')).toEqual(false);
});

test('isValidExpression correctly identifies valid formulas', () => {
  expect(isValidExpression('x')).toEqual(true);
  expect(isValidExpression('x+1')).toEqual(true);
  expect(isValidExpression('y=x-1')).toEqual(true);
  expect(isValidExpression('y = x - 1')).toEqual(true);
  expect(isValidExpression('y = (x < 100 and x > 0) * 100')).toEqual(true);
});
