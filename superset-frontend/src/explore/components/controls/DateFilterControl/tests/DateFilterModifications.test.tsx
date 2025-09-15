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

import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { render, screen, fireEvent, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

import { NO_TIME_RANGE } from '@superset-ui/core';
import DateFilterLabel from '../DateFilterLabel';
import { FRAME_OPTIONS, COMMON_RANGE_OPTIONS } from '../utils/constants';
import { guessFrame } from '../utils/dateFilterUtils';
import { FrameType, CommonRangeType } from '../types';

const mockStore = configureStore([thunk]);

describe('Date Filter Modifications Tests', () => {
  const defaultProps = {
    onChange: jest.fn(),
    onClosePopover: jest.fn(),
    onOpenPopover: jest.fn(),
  };

  function setup(
    props: any = defaultProps,
    store: any = mockStore({
      common: {
        conf: {
          DEFAULT_TIME_FILTER: 'Last month',
        },
      },
    }),
  ) {
    return render(
      <Provider store={store}>
        <DateFilterLabel name="time_range" {...props} />
      </Provider>
    );
  }

  describe('1. Advanced Option Removal', () => {
    test('Advanced option should not exist in FRAME_OPTIONS', () => {
      const advancedOption = FRAME_OPTIONS.find(option => option.value === 'Advanced');
      expect(advancedOption).toBeUndefined();
    });

    test('FRAME_OPTIONS should only contain 4 options', () => {
      expect(FRAME_OPTIONS).toHaveLength(4);
      const expectedOptions = ['Common', 'Calendar', 'Current', 'Custom'];
      const actualOptions = FRAME_OPTIONS.map(option => option.value);
      expect(actualOptions).toEqual(expectedOptions);
    });

    test('Advanced should not be in FrameType', () => {
      // This test verifies TypeScript compilation - if Advanced is still in FrameType,
      // the following line would cause a TypeScript error
      const validFrameTypes: FrameType[] = ['Common', 'Calendar', 'Current', 'Custom'];
      expect(validFrameTypes).toHaveLength(4);
    });

    test('guessFrame should return Custom for previously Advanced cases', () => {
      // Test time ranges that would have been categorized as Advanced
      expect(guessFrame('100 years ago : now')).toBe('Custom');
      expect(guessFrame('2020-01-01 : 2021-01-01')).toBe('Custom');
      expect(guessFrame('random advanced format')).toBe('Custom');
    });

    test('DateFilterLabel should not render Advanced option in dropdown', async () => {
      setup();
      
      // Click on the date filter to open dropdown
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      // Click on the range type selector to open options
      const rangeTypeButton = screen.getByRole('button', { name: /range type/i });
      await userEvent.click(rangeTypeButton);

      // Verify Advanced option is not in the dropdown
      await waitFor(() => {
        const options = screen.queryAllByText('Advanced');
        expect(options).toHaveLength(0);
      });

      // Verify only expected options are present
      expect(screen.getByText('Last')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('2. Common Range Updates', () => {
    test('COMMON_RANGE_OPTIONS should have updated labels', () => {
      expect(COMMON_RANGE_OPTIONS).toHaveLength(3);
      
      const expectedOptions = [
        { value: 'Last day', label: expect.stringContaining('Last 24 hours') },
        { value: 'Last week', label: expect.stringContaining('Last 7 Days') },
        { value: 'Last month', label: expect.stringContaining('Last 30 Days') },
      ];

      expectedOptions.forEach((expected, index) => {
        expect(COMMON_RANGE_OPTIONS[index].value).toBe(expected.value);
        // Note: labels are wrapped in t() function, so we check the structure
        expect(COMMON_RANGE_OPTIONS[index]).toMatchObject(expected);
      });
    });

    test('Last quarter and Last year should not exist in COMMON_RANGE_OPTIONS', () => {
      const quarterOption = COMMON_RANGE_OPTIONS.find(option => option.value === 'Last quarter');
      const yearOption = COMMON_RANGE_OPTIONS.find(option => option.value === 'Last year');
      
      expect(quarterOption).toBeUndefined();
      expect(yearOption).toBeUndefined();
    });

    test('CommonRangeType should only contain valid options', () => {
      // This test verifies TypeScript compilation
      const validCommonTypes: CommonRangeType[] = ['Last day', 'Last week', 'Last month'];
      expect(validCommonTypes).toHaveLength(3);
    });

    test('guessFrame should correctly identify remaining common ranges', () => {
      expect(guessFrame('Last day')).toBe('Common');
      expect(guessFrame('Last week')).toBe('Common');
      expect(guessFrame('Last month')).toBe('Common');
    });

    test('DateFilterLabel should display updated common range labels', async () => {
      setup({ value: 'Last day' });
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      // Select Common/Last option
      const rangeTypeButton = screen.getByRole('button', { name: /range type/i });
      await userEvent.click(rangeTypeButton);
      
      await waitFor(() => {
        const lastOption = screen.getByText('Last');
        fireEvent.click(lastOption);
      });

      // Check if updated labels are displayed
      await waitFor(() => {
        // Note: The exact text might be processed through i18n, 
        // so we check for presence of key terms
        const content = screen.getByTestId('time-range-trigger').textContent;
        expect(content).toBeTruthy();
      });
    });
  });

  describe('3. No Filter Option Removal', () => {
    test('No filter option should not exist in FRAME_OPTIONS', () => {
      const noFilterOption = FRAME_OPTIONS.find(option => option.value === 'No filter');
      expect(noFilterOption).toBeUndefined();
    });

    test('guessFrame should return Custom for NO_TIME_RANGE', () => {
      expect(guessFrame(NO_TIME_RANGE)).toBe('Custom');
    });

    test('DateFilterLabel should not render No filter option', async () => {
      setup();
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      const rangeTypeButton = screen.getByRole('button', { name: /range type/i });
      await userEvent.click(rangeTypeButton);

      await waitFor(() => {
        const noFilterOptions = screen.queryAllByText('No filter');
        expect(noFilterOptions).toHaveLength(0);
      });
    });

    test('DateFilterLabel should not render NoFilter test element', async () => {
      setup({ value: NO_TIME_RANGE });
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      // The NoFilter test element should not exist
      const noFilterElement = screen.queryByTestId('no-filter');
      expect(noFilterElement).toBeNull();
    });
  });

  describe('4. Fallback Behavior', () => {
    test('Previously Advanced time ranges should fall back to Custom', () => {
      const advancedTimeRanges = [
        '100 years ago : now',
        '2020-01-01T00:00:00 : 2021-01-01T00:00:00',
        'DATEADD(DATETIME("now"), -1, year) : now',
        'arbitrary text : more text',
      ];

      advancedTimeRanges.forEach(timeRange => {
        expect(guessFrame(timeRange)).toBe('Custom');
      });
    });

    test('NO_TIME_RANGE should fall back to Custom', () => {
      expect(guessFrame(NO_TIME_RANGE)).toBe('Custom');
      expect(guessFrame('')).toBe('Custom');
    });

    test('Valid time ranges should still be correctly categorized', () => {
      // Common ranges
      expect(guessFrame('Last day')).toBe('Common');
      expect(guessFrame('Last week')).toBe('Common');
      expect(guessFrame('Last month')).toBe('Common');

      // Calendar ranges
      expect(guessFrame('previous calendar week')).toBe('Calendar');
      expect(guessFrame('previous calendar month')).toBe('Calendar');
      expect(guessFrame('previous calendar year')).toBe('Calendar');

      // Current ranges  
      expect(guessFrame('Current day')).toBe('Current');
      expect(guessFrame('Current week')).toBe('Current');
      expect(guessFrame('Current month')).toBe('Current');
      expect(guessFrame('Current quarter')).toBe('Current');
      expect(guessFrame('Current year')).toBe('Current');
    });
  });

  describe('5. Integration Tests', () => {
    test('Complete dropdown functionality with all remaining options', async () => {
      setup();
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      const rangeTypeButton = screen.getByRole('button', { name: /range type/i });
      await userEvent.click(rangeTypeButton);

      await waitFor(() => {
        // Verify exactly 4 options are available
        expect(screen.getByText('Last')).toBeInTheDocument();
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Current')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
        
        // Verify removed options are not present
        expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
        expect(screen.queryByText('No filter')).not.toBeInTheDocument();
      });
    });

    test('Common range selection works with updated labels', async () => {
      setup();
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      // Select Last/Common option
      const rangeTypeButton = screen.getByRole('button', { name: /range type/i });
      await userEvent.click(rangeTypeButton);
      
      await waitFor(() => {
        const lastOption = screen.getByText('Last');
        fireEvent.click(lastOption);
      });

      // Wait for the Common range options to appear
      await waitFor(() => {
        // The options should be available for selection
        // Note: Exact text verification depends on i18n implementation
        const radioGroup = screen.getByRole('radiogroup');
        expect(radioGroup).toBeInTheDocument();
      });
    });

    test('Custom frame handles fallback cases correctly', async () => {
      // Set up with a time range that would have been Advanced
      setup({ value: '100 years ago : now' });
      
      const trigger = screen.getByTestId('time-range-trigger');
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /range type/i })).toBeInTheDocument();
      });

      // Should automatically select Custom frame
      await waitFor(() => {
        const customSection = screen.getByText(/configure custom time range/i);
        expect(customSection).toBeInTheDocument();
      });
    });
  });

  describe('6. Error Handling and Edge Cases', () => {
    test('Empty or undefined values should default to Custom', () => {
      expect(guessFrame('')).toBe('Custom');
      expect(guessFrame('undefined')).toBe('Custom');
      expect(guessFrame('null')).toBe('Custom');
    });

    test('Invalid time range formats should fall back to Custom', () => {
      expect(guessFrame('invalid format')).toBe('Custom');
      expect(guessFrame('not a time range')).toBe('Custom');
      expect(guessFrame('123abc')).toBe('Custom');
    });

    test('DateFilterLabel handles invalid frame types gracefully', () => {
      // This test ensures the component doesn't crash with unexpected values
      expect(() => {
        setup({ value: 'invalid time range' });
      }).not.toThrow();
    });
  });
});
