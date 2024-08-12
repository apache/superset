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
import { getComparisonFontSize, getHeaderFontSize } from './utils';

test('getHeaderFontSize', () => {
  expect(getHeaderFontSize(0.2)).toEqual(16);
  expect(getHeaderFontSize(0.3)).toEqual(20);
  expect(getHeaderFontSize(0.4)).toEqual(30);
  expect(getHeaderFontSize(0.5)).toEqual(48);
  expect(getHeaderFontSize(0.6)).toEqual(60);
  expect(getHeaderFontSize(0.15)).toEqual(60);
  expect(getHeaderFontSize(2)).toEqual(60);
});

test('getComparisonFontSize', () => {
  expect(getComparisonFontSize(0.125)).toEqual(16);
  expect(getComparisonFontSize(0.15)).toEqual(20);
  expect(getComparisonFontSize(0.2)).toEqual(26);
  expect(getComparisonFontSize(0.3)).toEqual(32);
  expect(getComparisonFontSize(0.4)).toEqual(40);
  expect(getComparisonFontSize(0.05)).toEqual(40);
  expect(getComparisonFontSize(0.9)).toEqual(40);
});
