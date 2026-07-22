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
import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const onContextMenu = jest.fn();
const setDataMask = jest.fn();

const createProps = (formDataOverrides = {}, chartPropsOverrides = {}) =>
  ({
    width: 800,
    height: 600,
    formData: {
      entity: 'country_code',
      linearColorScheme: 'bnbColors',
      numberFormat: '.2f',
      selectCountry: 'France',
      colorScheme: '',
      sliceId: 1,
      metric: 'count',
      ...formDataOverrides,
    },
    queriesData: [{ data: [{ country_id: 'FRA', metric: 10 }] }],
    datasource: { currencyFormats: {}, columnFormats: {} },
    hooks: { onContextMenu, setDataMask },
    filterState: { selectedValues: ['FRA'] },
    emitCrossFilters: true,
    ...chartPropsOverrides,
  }) as unknown as ChartProps;

test('forwards cross-filter hooks and state to the chart', () => {
  const transformed = transformProps(createProps());

  expect(transformed).toMatchObject({
    width: 800,
    height: 600,
    entity: 'country_code',
    onContextMenu,
    setDataMask,
    emitCrossFilters: true,
    filterState: { selectedValues: ['FRA'] },
    data: [{ country_id: 'FRA', metric: 10 }],
  });
});

test('lowercases the selected country for map lookup', () => {
  const transformed = transformProps(createProps());
  expect(transformed.country).toBe('france');
});

test('passes a null country when none is selected', () => {
  const transformed = transformProps(createProps({ selectCountry: undefined }));
  expect(transformed.country).toBeNull();
});

test('defaults hooks to an empty object when none are provided', () => {
  const transformed = transformProps(createProps({}, { hooks: undefined }));
  expect(transformed.onContextMenu).toBeUndefined();
  expect(transformed.setDataMask).toBeUndefined();
});
