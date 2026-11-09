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
import type { MenuItemType } from '@superset-ui/core/components/Menu';
import {
  FilterMetadata,
  getCsvFilterMetadataItems,
  toFilterMetadata,
} from './exportFilterMetadata';

const clickItem = (item: MenuItemType) =>
  item.onClick?.({} as Parameters<NonNullable<MenuItemType['onClick']>>[0]);

test('toFilterMetadata keeps known options', () => {
  expect(toFilterMetadata('separate')).toBe(FilterMetadata.Separate);
  expect(toFilterMetadata('none')).toBe(FilterMetadata.None);
});

test('toFilterMetadata treats anything else as no filter metadata', () => {
  expect(toFilterMetadata(undefined)).toBe(FilterMetadata.None);
  expect(toFilterMetadata('inline')).toBe(FilterMetadata.None);
  expect(toFilterMetadata({ key: 'csv' })).toBe(FilterMetadata.None);
});

test('getCsvFilterMetadataItems offers each option with unique keys', () => {
  const onSelect = jest.fn();
  const items = getCsvFilterMetadataItems({
    keyPrefix: 'export_csv',
    onSelect,
  }) as MenuItemType[];

  expect(items.map(item => item.key)).toEqual([
    'export_csv-none',
    'export_csv-separate',
  ]);
  expect(items.map(item => item.label)).toEqual([
    'Without filter metadata',
    'Include filters as a separate file',
  ]);
  expect(items.every(item => !item.disabled)).toBe(true);

  clickItem(items[1]);
  expect(onSelect).toHaveBeenCalledWith(FilterMetadata.Separate);
});

test('getCsvFilterMetadataItems greys out only the separate file', () => {
  const items = getCsvFilterMetadataItems({
    keyPrefix: 'export_csv',
    onSelect: jest.fn(),
    separateDisabled: true,
  }) as MenuItemType[];

  expect(items.map(item => item.disabled)).toEqual([false, true]);
});
