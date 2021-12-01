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
import { FilterSet } from 'src/dashboard/reducers/types';
import { findExistingFilterSet } from '.';

const createDataMaskSelected = () => ({
  filterId: { filterState: { value: 'value-1' } },
  filterId2: { filterState: { value: 'value-2' } },
});

test('Should find correct filter', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues: FilterSet[] = [
    {
      id: 1,
      name: 'name-01',
      nativeFilters: {},
      dataMask: {
        filterId: { id: 'filterId', filterState: { value: 'value-1' } },
        filterId2: { id: 'filterId2', filterState: { value: 'value-2' } },
      } as any,
    },
  ];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toEqual({
    dataMask: {
      filterId: { id: 'filterId', filterState: { value: 'value-1' } },
      filterId2: { id: 'filterId2', filterState: { value: 'value-2' } },
    },
    id: 1,
    name: 'name-01',
    nativeFilters: {},
  });
});

test('Should return undefined when nativeFilters has less values', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues = [
    {
      id: 1,
      name: 'name-01',
      nativeFilters: {},
      dataMask: {
        filterId: { id: 'filterId', filterState: { value: 'value-1' } },
      } as any,
    },
  ];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toBeUndefined();
});

test('Should return undefined when nativeFilters has different values', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues: FilterSet[] = [
    {
      id: 1,
      name: 'name-01',
      nativeFilters: {},
      dataMask: {
        filterId: { id: 'filterId', filterState: { value: 'value-1' } },
        filterId2: { id: 'filterId2', filterState: { value: 'value-1' } },
      },
    },
  ];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toBeUndefined();
});

test('Should return undefined when dataMask:{}', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues = [
    {
      id: 1,
      name: 'name-01',
      nativeFilters: {},
      dataMask: {},
    },
  ];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toBeUndefined();
});

test('Should return undefined when dataMask is empty}', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues: FilterSet[] = [
    {
      id: 1,
      name: 'name-01',
      nativeFilters: {},
      dataMask: {},
    },
  ];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toBeUndefined();
});

test('Should return undefined when filterSetFilterValues is []', () => {
  const dataMaskSelected = createDataMaskSelected();
  const filterSetFilterValues: FilterSet[] = [];
  const response = findExistingFilterSet({
    filterSetFilterValues,
    dataMaskSelected,
  });
  expect(response).toBeUndefined();
});
