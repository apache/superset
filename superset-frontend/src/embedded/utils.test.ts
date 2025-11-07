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
import { DataMaskStateWithId } from '@superset-ui/core';
import { cloneDeep } from 'lodash';
import { getDataMaskChangeTrigger } from './utils';

const dataMask: DataMaskStateWithId = {
  '1': {
    id: '1',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
  '2': {
    id: '2',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
  'NATIVE_FILTER-1': {
    id: 'NATIVE_FILTER-1',
    extraFormData: {},
    filterState: {
      value: null,
    },
    ownState: {},
  },
  'NATIVE_FILTER-2': {
    id: 'NATIVE_FILTER-2',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
};

it('datamask didnt change - both triggers set to false', () => {
  const previousDataMask = cloneDeep(dataMask);
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: false,
    nativeFiltersChanged: false,
  });
});

it('a native filter changed - nativeFiltersChanged set to true', () => {
  const previousDataMask = cloneDeep(dataMask);
  previousDataMask['NATIVE_FILTER-1'].filterState!.value = 'test';
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: false,
    nativeFiltersChanged: true,
  });
});

it('a cross filter changed - crossFiltersChanged set to true', () => {
  const previousDataMask = cloneDeep(dataMask);
  previousDataMask['1'].filterState!.value = 'test';
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: true,
    nativeFiltersChanged: false,
  });
});
