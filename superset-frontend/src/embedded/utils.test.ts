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
