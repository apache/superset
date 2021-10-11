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
import { isEqualWith } from 'lodash';
import {
  undefinedCustomizer,
  ignorePropsCustomizer,
  compoundCustomizer,
} from './isEqualCustomizers';

test('ignores undefined with truthty result', () => {
  expect(
    isEqualWith({ a: 1, b: undefined }, { a: 1, b: 2 }, undefinedCustomizer),
  ).toBe(true);
});

test('ignores undefined with falsy result', () => {
  expect(
    isEqualWith({ a: 1, b: undefined }, { a: 2, b: 2 }, undefinedCustomizer),
  ).toBe(false);
});

test('ignores props with truthty result', () => {
  const customizer = ignorePropsCustomizer('b', 'c');
  expect(
    isEqualWith({ a: 1, b: 1, c: 1 }, { a: 1, b: 2, c: 2 }, customizer),
  ).toBe(true);
});

test('ignores props with falsy result', () => {
  const customizer = ignorePropsCustomizer('b', 'c');
  expect(
    isEqualWith({ a: 1, b: 1, c: 1 }, { a: 2, b: 2, c: 2 }, customizer),
  ).toBe(false);
});

test('ignores undefined and props with truthty result', () => {
  const propsCustomizer = ignorePropsCustomizer('b');
  const customizer = compoundCustomizer(undefinedCustomizer, propsCustomizer);
  expect(
    isEqualWith({ a: 1, b: 1, c: 1 }, { a: 1, b: 2, c: undefined }, customizer),
  ).toBe(true);
});

test('ignores undefined and props with falsy result', () => {
  const propsCustomizer = ignorePropsCustomizer('b');
  const customizer = compoundCustomizer(undefinedCustomizer, propsCustomizer);
  expect(
    isEqualWith({ a: 1, b: 1, c: 1 }, { a: 2, b: 2, c: undefined }, customizer),
  ).toBe(false);
});
