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

import { DataMaskStateWithId, Filter } from '@superset-ui/core';
import {
  checkIsApplyDisabled,
  checkIsValidateError,
  checkIsMissingRequiredValue,
} from './utils';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('FilterBar Utils - Validation and Apply Logic', () => {
  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('checkIsValidateError', () => {
    test('should return true when no filters have validation errors', () => {
      const dataMask: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: ['CA'],
          },
          extraFormData: {},
        },
        'filter-2': {
          id: 'filter-2',
          filterState: {
            validateStatus: undefined,
            value: ['NY'],
          },
          extraFormData: {},
        },
      };

      expect(checkIsValidateError(dataMask)).toBe(true);
    });

    test('should return false when any filter has validation error', () => {
      const dataMask: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: 'error',
            value: undefined,
          },
          extraFormData: {},
        },
        'filter-2': {
          id: 'filter-2',
          filterState: {
            validateStatus: undefined,
            value: ['NY'],
          },
          extraFormData: {},
        },
      };

      expect(checkIsValidateError(dataMask)).toBe(false);
    });

    test('should handle empty dataMask', () => {
      const dataMask: DataMaskStateWithId = {};
      expect(checkIsValidateError(dataMask)).toBe(true);
    });

    test('should handle filters without filterState', () => {
      const dataMask: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          extraFormData: {},
        },
      };

      expect(checkIsValidateError(dataMask)).toBe(true);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('checkIsMissingRequiredValue', () => {
    test('should return true for required filter with undefined value', () => {
      const filter = {
        id: 'test-filter',
        controlValues: {
          enableEmptyFilter: true,
        },
      } as unknown as Filter;

      const filterState = {
        value: undefined,
      };

      expect(checkIsMissingRequiredValue(filter, filterState)).toBe(true);
    });

    test('should return true for required filter with null value', () => {
      const filter = {
        id: 'test-filter',
        controlValues: {
          enableEmptyFilter: true,
        },
      } as unknown as Filter;

      const filterState = {
        value: null,
      };

      expect(checkIsMissingRequiredValue(filter, filterState)).toBe(true);
    });

    test('should return false for required filter with valid value', () => {
      const filter = {
        id: 'test-filter',
        controlValues: {
          enableEmptyFilter: true,
        },
      } as unknown as Filter;

      const filterState = {
        value: ['CA'],
      };

      expect(checkIsMissingRequiredValue(filter, filterState)).toBe(false);
    });

    test('should return false for non-required filter with undefined value', () => {
      const filter = {
        id: 'test-filter',
        controlValues: {
          enableEmptyFilter: false,
        },
      } as unknown as Filter;

      const filterState = {
        value: undefined,
      };

      expect(checkIsMissingRequiredValue(filter, filterState)).toBe(false);
    });

    test('should return false for filter without controlValues', () => {
      const filter = {
        id: 'test-filter',
      } as Filter;

      const filterState = {
        value: undefined,
      };

      // checkIsMissingRequiredValue returns undefined when controlValues is missing
      // undefined is falsy, so we check for truthiness instead of exact false
      expect(checkIsMissingRequiredValue(filter, filterState)).toBeFalsy();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('checkIsApplyDisabled', () => {
    test('should return true when filters have validation errors', () => {
      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: 'error',
            value: undefined,
          },
          extraFormData: {},
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: true,
          },
        } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(true);
    });

    test('should return false when selected and applied states differ', () => {
      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: ['NY'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['NY'] }],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: false,
          },
        } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });

    test('should return true when selected and applied states are identical', () => {
      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: false,
          },
        } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(true);
    });

    test('should return true when required filter is missing value in selected state', () => {
      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: undefined,
          },
          extraFormData: {},
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: true, // Required filter
          },
        } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(true);
    });

    test('should enable Apply when new filter is selected', () => {
      // User selects a new filter that hasn't been applied yet
      // Apply should be ENABLED to allow applying the new selection
      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
        'filter-2': {
          id: 'filter-2',
          filterState: {
            validateStatus: undefined,
            value: ['Product A'],
          },
          extraFormData: {
            filters: [{ col: 'product', op: 'IN', val: ['Product A'] }],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
        // filter-2 not yet applied
      };

      const filters: Filter[] = [
        { id: 'filter-1', controlValues: {} } as unknown as Filter,
        { id: 'filter-2', controlValues: {} } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });

    test('should handle validation status recalculation scenario', () => {
      // Scenario: Filter was required and had error, then user selected value
      // The validateStatus should be cleared and Apply should be enabled

      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined, // Error cleared after selection
            value: ['CA'],
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: undefined, // Previously cleared
          },
          extraFormData: {},
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: true,
          },
        } as unknown as Filter,
      ];

      // Should be enabled because states differ and no validation errors
      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });

    test('should not disable Apply when required filter is auto-applied (bug fix)', () => {
      // Bug scenario: Filter A has "required" + "select first by default"
      // Filter A auto-applies and is synced to selected
      // User changes Filter B (adds it to selected, not in applied yet)
      // Apply button should be ENABLED (changes exist and required filter has value)

      const dataMaskSelected: DataMaskStateWithId = {
        'filter-country': {
          id: 'filter-country',
          filterState: {
            validateStatus: undefined,
            value: ['USA'], // Auto-applied value (synced from applied)
          },
          extraFormData: {
            filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
          },
        },
        'filter-product': {
          id: 'filter-product',
          filterState: {
            validateStatus: undefined,
            value: ['Product A'], // User changed this filter
          },
          extraFormData: {
            filters: [{ col: 'product_line', op: 'IN', val: ['Product A'] }],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-country': {
          id: 'filter-country',
          filterState: {
            value: ['USA'], // Already applied
          },
          extraFormData: {
            filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
          },
        },
        // filter-product not yet applied
      };

      const filters: Filter[] = [
        {
          id: 'filter-country',
          controlValues: {
            enableEmptyFilter: true, // Required filter
          },
        } as unknown as Filter,
        {
          id: 'filter-product',
          controlValues: {
            enableEmptyFilter: false,
          },
        } as unknown as Filter,
      ];

      // Should be ENABLED - Filter B has changes to apply and Filter A (required) has value
      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });

    test('should not disable Apply when required filter is only in applied state during sync gap', () => {
      // Edge case: Required filter auto-applied but not yet synced to selected
      // The filter is NOT in dataMaskSelected at all (key doesn't exist)
      // This can happen during the React state update cycle
      // Apply button should still be enabled if other filters have changes

      const dataMaskSelected: DataMaskStateWithId = {
        'filter-product': {
          id: 'filter-product',
          filterState: {
            validateStatus: undefined,
            value: ['Product B'],
          },
          extraFormData: {
            filters: [{ col: 'product_line', op: 'IN', val: ['Product B'] }],
          },
        },
        // filter-country not yet in selected (sync gap) - KEY DOESN'T EXIST
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-country': {
          id: 'filter-country',
          filterState: {
            value: ['USA'], // Auto-applied, has value
          },
          extraFormData: {
            filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
          },
        },
        // filter-product not yet applied
      };

      const filters: Filter[] = [
        {
          id: 'filter-country',
          controlValues: {
            enableEmptyFilter: true, // Required filter
          },
        } as unknown as Filter,
        {
          id: 'filter-product',
          controlValues: {
            enableEmptyFilter: false,
          },
        } as unknown as Filter,
      ];

      // Should be ENABLED - Required filter has value in applied state (auto-applied),
      // and it's not in selected at all (not explicitly cleared by user)
      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });

    test('should disable Apply when user explicitly clears a required filter value', () => {
      // Different from sync gap: filter IS in selected state but with undefined value
      // This means user explicitly cleared it
      // Apply should be DISABLED because it's a required filter

      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: undefined, // User explicitly cleared the value
          },
          extraFormData: {},
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['CA'], // Previously had a value
          },
          extraFormData: {
            filters: [{ col: 'state', op: 'IN', val: ['CA'] }],
          },
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: true, // Required filter
          },
        } as unknown as Filter,
      ];

      // Should be DISABLED - User cleared a required filter
      // Even though it has value in applied state, the selected state shows user intent
      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(true);
    });

    test('should enable Apply when filter has value but needs extraFormData update (PR #36927 regression test)', () => {
      // Original bug from PR #36927: defaultDataMask has value but empty extraFormData
      // The filter loads with a value in applied state but no extraFormData
      // Then the filter plugin generates extraFormData and updates selected state
      // Apply should be ENABLED to allow the extraFormData to be applied

      const dataMaskSelected: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            validateStatus: undefined,
            value: ['value1', 'value2'], // Same value
          },
          extraFormData: {
            // Now has extraFormData generated by filter plugin
            filters: [
              { col: 'test_column', op: 'IN', val: ['value1', 'value2'] },
            ],
          },
        },
      };

      const dataMaskApplied: DataMaskStateWithId = {
        'filter-1': {
          id: 'filter-1',
          filterState: {
            value: ['value1', 'value2'], // Has value from defaultDataMask
          },
          extraFormData: {}, // But extraFormData is empty (the bug scenario)
        },
      };

      const filters: Filter[] = [
        {
          id: 'filter-1',
          controlValues: {
            enableEmptyFilter: true, // Required filter
          },
        } as unknown as Filter,
      ];

      // Should be ENABLED because extraFormData changed (not equal)
      // even though the value is the same
      // This allows the auto-apply logic to update the applied state with extraFormData
      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(false);
    });
  });
});
