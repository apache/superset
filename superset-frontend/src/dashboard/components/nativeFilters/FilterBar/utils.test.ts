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

import {
  DataMaskStateWithId,
  DataRecordValue,
  Filter,
  FilterState,
} from '@superset-ui/core';
import {
  checkIsApplyDisabled,
  checkIsValidateError,
  checkIsMissingRequiredValue,
  getOnlyExtraFormData,
  getFiltersToApply,
} from './utils';

// Factory functions for test data
function createDataMaskEntry(
  id: string,
  overrides: {
    value?: unknown;
    validateStatus?: 'error' | undefined;
    extraFormData?: Record<string, unknown>;
  } = {},
) {
  const { value, validateStatus, extraFormData = {} } = overrides;
  return {
    id,
    filterState: {
      value,
      validateStatus,
    },
    extraFormData,
  };
}

function createFilter(
  id: string,
  overrides: {
    enableEmptyFilter?: boolean;
    controlValues?: Record<string, unknown>;
  } = {},
): Filter {
  const { enableEmptyFilter, controlValues = {} } = overrides;
  return {
    id,
    controlValues: {
      ...(enableEmptyFilter !== undefined && { enableEmptyFilter }),
      ...controlValues,
    },
  } as unknown as Filter;
}

function createExtraFormDataWithFilter(
  col: string,
  val: DataRecordValue[],
  op: 'IN' | 'NOT IN' = 'IN',
) {
  return {
    filters: [{ col, op, val }],
  };
}

// getOnlyExtraFormData tests
test('getOnlyExtraFormData extracts extraFormData from all filters when no filterIds provided', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    },
    'filter-2': {
      id: 'filter-2',
      filterState: { value: ['NY'] },
      extraFormData: { filters: [{ col: 'city', op: 'IN', val: ['NY'] }] },
    },
  };

  const result = getOnlyExtraFormData(dataMask);

  expect(result).toEqual({
    'filter-1': { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    'filter-2': { filters: [{ col: 'city', op: 'IN', val: ['NY'] }] },
  });
});

test('getOnlyExtraFormData only extracts extraFormData for specified filterIds', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    },
    'filter-2': {
      id: 'filter-2',
      filterState: { value: ['NY'] },
      extraFormData: { filters: [{ col: 'city', op: 'IN', val: ['NY'] }] },
    },
    'filter-3': {
      id: 'filter-3',
      filterState: { value: ['Product'] },
      extraFormData: {
        filters: [{ col: 'product', op: 'IN', val: ['Product'] }],
      },
    },
  };

  const filterIds = new Set(['filter-1', 'filter-3']);
  const result = getOnlyExtraFormData(dataMask, filterIds);

  expect(result).toEqual({
    'filter-1': { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    'filter-3': { filters: [{ col: 'product', op: 'IN', val: ['Product'] }] },
  });
  expect(result).not.toHaveProperty('filter-2');
});

test('getOnlyExtraFormData returns empty object when filterIds is empty set', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    },
  };

  const filterIds = new Set<string>();
  const result = getOnlyExtraFormData(dataMask, filterIds);

  expect(result).toEqual({});
});

// checkIsValidateError tests
test('checkIsValidateError returns true when no filters have validation errors', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': createDataMaskEntry('filter-1', { value: ['CA'] }),
    'filter-2': createDataMaskEntry('filter-2', { value: ['NY'] }),
  };

  expect(checkIsValidateError(dataMask)).toBe(true);
});

test('checkIsValidateError returns false when any filter has validation error', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': createDataMaskEntry('filter-1', { validateStatus: 'error' }),
    'filter-2': createDataMaskEntry('filter-2', { value: ['NY'] }),
  };

  expect(checkIsValidateError(dataMask)).toBe(false);
});

test('checkIsValidateError handles empty dataMask', () => {
  const dataMask: DataMaskStateWithId = {};
  expect(checkIsValidateError(dataMask)).toBe(true);
});

test('checkIsValidateError handles filters without filterState', () => {
  const dataMask: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      extraFormData: {},
    },
  };

  expect(checkIsValidateError(dataMask)).toBe(true);
});

// checkIsMissingRequiredValue tests
test('checkIsMissingRequiredValue returns true for required filter with undefined value', () => {
  const filter = createFilter('test-filter', { enableEmptyFilter: true });
  const filterState: FilterState = { value: undefined };

  expect(checkIsMissingRequiredValue(filter, filterState)).toBe(true);
});

test('checkIsMissingRequiredValue returns true for required filter with null value', () => {
  const filter = createFilter('test-filter', { enableEmptyFilter: true });
  const filterState: FilterState = { value: null };

  expect(checkIsMissingRequiredValue(filter, filterState)).toBe(true);
});

test('checkIsMissingRequiredValue returns false for required filter with valid value', () => {
  const filter = createFilter('test-filter', { enableEmptyFilter: true });
  const filterState: FilterState = { value: ['CA'] };

  expect(checkIsMissingRequiredValue(filter, filterState)).toBe(false);
});

test('checkIsMissingRequiredValue returns false for non-required filter with undefined value', () => {
  const filter = createFilter('test-filter', { enableEmptyFilter: false });
  const filterState: FilterState = { value: undefined };

  expect(checkIsMissingRequiredValue(filter, filterState)).toBe(false);
});

test('checkIsMissingRequiredValue returns falsy for filter without controlValues', () => {
  const filter = { id: 'test-filter' } as Filter;
  const filterState: FilterState = { value: undefined };

  expect(checkIsMissingRequiredValue(filter, filterState)).toBeFalsy();
});

// checkIsApplyDisabled tests
test('checkIsApplyDisabled returns true when filters have validation errors', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': createDataMaskEntry('filter-1', { validateStatus: 'error' }),
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const filters = [createFilter('filter-1', { enableEmptyFilter: true })];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    true,
  );
});

test('checkIsApplyDisabled returns false when selected and applied states differ', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['NY'] },
      extraFormData: createExtraFormDataWithFilter('state', ['NY']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const filters = [createFilter('filter-1', { enableEmptyFilter: false })];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    false,
  );
});

test('checkIsApplyDisabled returns true when selected and applied states are identical', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const filters = [createFilter('filter-1', { enableEmptyFilter: false })];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    true,
  );
});

test('checkIsApplyDisabled returns true when required filter is missing value in selected state', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': createDataMaskEntry('filter-1', { value: undefined }),
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const filters = [createFilter('filter-1', { enableEmptyFilter: true })];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    true,
  );
});

test('checkIsApplyDisabled handles filter count mismatch', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
    'filter-2': {
      id: 'filter-2',
      filterState: { value: ['Product A'] },
      extraFormData: createExtraFormDataWithFilter('product', ['Product A']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const filters = [createFilter('filter-1'), createFilter('filter-2')];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    true,
  );
});

test('checkIsApplyDisabled handles validation status recalculation scenario', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { validateStatus: undefined, value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-1': {
      id: 'filter-1',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const filters = [createFilter('filter-1', { enableEmptyFilter: true })];

  expect(checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters)).toBe(
    false,
  );
});

test('checkIsApplyDisabled detects out-of-scope changes and enables Apply for explicit user changes', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
    'filter-out-of-scope': {
      id: 'filter-out-of-scope',
      filterState: { value: ['New Product'] },
      extraFormData: createExtraFormDataWithFilter('product', ['New Product']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
    'filter-out-of-scope': {
      id: 'filter-out-of-scope',
      filterState: { value: ['Product A'] },
      extraFormData: createExtraFormDataWithFilter('product', ['Product A']),
    },
  };
  const filtersInScope = [createFilter('filter-in-scope')];

  expect(
    checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filtersInScope),
  ).toBe(false);
});

test('checkIsApplyDisabled enables apply when in-scope filter has changes regardless of out-of-scope state', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
    'filter-out-of-scope': {
      id: 'filter-out-of-scope',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['NY'] },
      extraFormData: createExtraFormDataWithFilter('state', ['NY']),
    },
    'filter-out-of-scope': {
      id: 'filter-out-of-scope',
      filterState: { value: ['Product A'] },
      extraFormData: createExtraFormDataWithFilter('product', ['Product A']),
    },
  };
  const filtersInScope = [createFilter('filter-in-scope')];

  expect(
    checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filtersInScope),
  ).toBe(false);
});

test('checkIsApplyDisabled only validates required filters that are in scope', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['CA'] },
      extraFormData: createExtraFormDataWithFilter('state', ['CA']),
    },
    'filter-out-of-scope-required': {
      id: 'filter-out-of-scope-required',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'filter-in-scope': {
      id: 'filter-in-scope',
      filterState: { value: ['NY'] },
      extraFormData: createExtraFormDataWithFilter('state', ['NY']),
    },
    'filter-out-of-scope-required': {
      id: 'filter-out-of-scope-required',
      filterState: { value: ['Product A'] },
      extraFormData: createExtraFormDataWithFilter('product', ['Product A']),
    },
  };
  const filtersInScope = [createFilter('filter-in-scope')];

  expect(
    checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filtersInScope),
  ).toBe(false);
});

test('CRITICAL: checkIsApplyDisabled Apply button must be ENABLED when out-of-scope filter has explicit changes', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['same-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['same-value']),
    },
    'tab-b-filter': {
      id: 'tab-b-filter',
      filterState: { value: ['new-value'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['new-value']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['same-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['same-value']),
    },
    'tab-b-filter': {
      id: 'tab-b-filter',
      filterState: { value: ['old-value'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['old-value']),
    },
  };
  const filtersInScope = [createFilter('tab-a-filter')];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
  );
  expect(result).toBe(false);
});

test('CRITICAL: checkIsApplyDisabled Apply button must only consider in-scope required filter validation', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-required': {
      id: 'tab-a-required',
      filterState: { value: ['has-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['has-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'tab-a-required': {
      id: 'tab-a-required',
      filterState: { value: ['old-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['old-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: ['had-value'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['had-value']),
    },
  };
  const filtersInScope = [
    createFilter('tab-a-required', { enableEmptyFilter: true }),
  ];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
  );
  expect(result).toBe(false);
});

test('checkIsApplyDisabled disables Apply when in-scope required filter is empty', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'required-filter': {
      id: 'required-filter',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'required-filter': {
      id: 'required-filter',
      filterState: { value: ['had-value'] },
      extraFormData: createExtraFormDataWithFilter('col', ['had-value']),
    },
  };
  const filtersInScope = [
    createFilter('required-filter', { enableEmptyFilter: true }),
  ];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
  );
  expect(result).toBe(true);
});

test('checkIsApplyDisabled enabled when in-scope filter has changes, even if out-of-scope required is empty', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['new-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['new-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['old-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['old-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: ['was-set'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['was-set']),
    },
  };
  const filtersInScope = [createFilter('tab-a-filter')];
  const allFilters = [
    createFilter('tab-a-filter'),
    createFilter('tab-b-required', { enableEmptyFilter: true }),
  ];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
    allFilters,
  );
  expect(result).toBe(false);
});

test('checkIsApplyDisabled disabled when ONLY out-of-scope changes exist and required filter is empty', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['same-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['same-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['same-value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['same-value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: ['was-set'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['was-set']),
    },
  };
  const filtersInScope = [createFilter('tab-a-filter')];
  const allFilters = [
    createFilter('tab-a-filter'),
    createFilter('tab-b-required', { enableEmptyFilter: true }),
  ];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
    allFilters,
  );
  expect(result).toBe(true);
});

test('checkIsApplyDisabled enabled when user sets value for out-of-scope required filter', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: ['user-selected'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['user-selected']),
    },
  };
  const dataMaskApplied: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['value'] },
      extraFormData: createExtraFormDataWithFilter('col_a', ['value']),
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: ['old-value'] },
      extraFormData: createExtraFormDataWithFilter('col_b', ['old-value']),
    },
  };
  const filtersInScope = [createFilter('tab-a-filter')];
  const allFilters = [
    createFilter('tab-a-filter'),
    createFilter('tab-b-required', { enableEmptyFilter: true }),
  ];

  const result = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
    allFilters,
  );
  expect(result).toBe(false);
});

// getFiltersToApply tests
test('CRITICAL: getFiltersToApply includes in-scope filters regardless of value', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'in-scope-with-value': {
      id: 'in-scope-with-value',
      filterState: { value: ['CA'] },
      extraFormData: {},
    },
    'in-scope-empty': {
      id: 'in-scope-empty',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const inScopeFilterIds = new Set(['in-scope-with-value', 'in-scope-empty']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).toContain('in-scope-with-value');
  expect(result).toContain('in-scope-empty');
});

test('CRITICAL: getFiltersToApply includes out-of-scope filters ONLY if they have a value', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'in-scope': {
      id: 'in-scope',
      filterState: { value: ['CA'] },
      extraFormData: {},
    },
    'out-of-scope-with-value': {
      id: 'out-of-scope-with-value',
      filterState: { value: ['Product'] },
      extraFormData: {},
    },
    'out-of-scope-empty': {
      id: 'out-of-scope-empty',
      filterState: { value: undefined },
      extraFormData: {},
    },
    'out-of-scope-null': {
      id: 'out-of-scope-null',
      filterState: { value: null },
      extraFormData: {},
    },
  };
  const inScopeFilterIds = new Set(['in-scope']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).toContain('in-scope');
  expect(result).toContain('out-of-scope-with-value');
  expect(result).not.toContain('out-of-scope-empty');
  expect(result).not.toContain('out-of-scope-null');
});

test('CRITICAL: getFiltersToApply scenario - Clear All on Tab B, then apply on Tab A', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['selected-value'] },
      extraFormData: {},
    },
    'tab-b-required': {
      id: 'tab-b-required',
      filterState: { value: undefined },
      extraFormData: {},
    },
  };
  const inScopeFilterIds = new Set(['tab-a-filter']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).toContain('tab-a-filter');
  expect(result).not.toContain('tab-b-required');
});

test('CRITICAL: getFiltersToApply scenario - Change out-of-scope filter via "Filters out of scope" panel', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'tab-a-filter': {
      id: 'tab-a-filter',
      filterState: { value: ['value-a'] },
      extraFormData: {},
    },
    'tab-b-filter': {
      id: 'tab-b-filter',
      filterState: { value: ['value-b'] },
      extraFormData: {},
    },
  };
  const inScopeFilterIds = new Set(['tab-a-filter']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).toContain('tab-a-filter');
  expect(result).toContain('tab-b-filter');
});

test('getFiltersToApply handles empty dataMaskSelected', () => {
  const dataMaskSelected: DataMaskStateWithId = {};
  const inScopeFilterIds = new Set(['filter-1']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).toEqual([]);
});

test('getFiltersToApply handles null dataMask entries', () => {
  const dataMaskSelected: DataMaskStateWithId = {
    'filter-1': null as any,
    'filter-2': {
      id: 'filter-2',
      filterState: { value: ['CA'] },
      extraFormData: {},
    },
  };
  const inScopeFilterIds = new Set(['filter-1', 'filter-2']);

  const result = getFiltersToApply(dataMaskSelected, inScopeFilterIds);

  expect(result).not.toContain('filter-1');
  expect(result).toContain('filter-2');
});
