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

describe('FilterBar Utils - Validation and Apply Logic', () => {
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

    test('should handle filter count mismatch', () => {
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
        // Missing filter-2
      };

      const filters: Filter[] = [
        { id: 'filter-1', controlValues: {} } as unknown as Filter,
        { id: 'filter-2', controlValues: {} } as unknown as Filter,
      ];

      expect(
        checkIsApplyDisabled(dataMaskSelected, dataMaskApplied, filters),
      ).toBe(true);
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
  });
});
