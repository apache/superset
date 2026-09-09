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
import { DndItemType } from '../DndItemType';
import { isCompatibleItem } from './compatibility';
import { DndItemValue } from './types';

const metric = { metric_name: 'sum__value' } as unknown as DndItemValue;
const column = { column_name: 'dt' } as unknown as DndItemValue;

test('metric is compatible when no compatibility filter is active', () => {
  expect(isCompatibleItem(DndItemType.Metric, metric, null, null)).toBe(true);
  expect(
    isCompatibleItem(DndItemType.Metric, metric, undefined, undefined),
  ).toBe(true);
});

test('metric is compatible only when listed in compatibleMetrics', () => {
  expect(
    isCompatibleItem(DndItemType.Metric, metric, ['sum__value'], null),
  ).toBe(true);
  expect(isCompatibleItem(DndItemType.Metric, metric, ['other'], null)).toBe(
    false,
  );
});

test('column is compatible when no compatibility filter is active', () => {
  expect(isCompatibleItem(DndItemType.Column, column, null, null)).toBe(true);
});

test('column is compatible only when listed in compatibleDimensions', () => {
  expect(isCompatibleItem(DndItemType.Column, column, null, ['dt'])).toBe(true);
  expect(isCompatibleItem(DndItemType.Column, column, null, ['other'])).toBe(
    false,
  );
});

test('unknown item types are always compatible', () => {
  expect(
    isCompatibleItem('unknown' as DndItemType, metric, ['other'], ['other']),
  ).toBe(true);
});
