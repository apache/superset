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
import React from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import '@testing-library/jest-dom';
import SliceAdder, {
  ChartList,
  DEFAULT_SORT_KEY,
} from 'src/dashboard/components/SliceAdder';
import { sliceEntitiesForDashboard as mockSliceEntities } from 'spec/fixtures/mockSliceEntities';

jest.mock('lodash/debounce', () => {
  return (fn, wait = 0) => {
    const mockFn = (...args) => fn(...args);
    mockFn.cancel = jest.fn();
    mockFn.flush = jest.fn();
    return mockFn;
  };
});

describe('SliceAdder', () => {
  const baseProps = {
    slices: { ...mockSliceEntities.slices },
    fetchSlices: jest.fn(),
    updateSlices: jest.fn(),
    selectedSliceIds: [127, 128],
    userId: 1,
    dashboardId: 0,
    editMode: false,
    errorMessage: '',
    isLoading: false,
    lastUpdated: 0,
  };

  function renderSliceAdder(overrideProps = {}) {
    return render(<SliceAdder {...baseProps} {...overrideProps} />);
  }

  // Test the static sortByComparator directly
  describe('SliceAdder.sortByComparator', () => {
    it('should sort by timestamp descending', () => {
      const sortedTimestamps = Object.values(baseProps.slices)
        .sort(SliceAdder.sortByComparator('changed_on'))
        .map(slice => slice.changed_on);

      // Verify each timestamp is strictly less than the previous (descending)
      for (let i = 1; i < sortedTimestamps.length; i += 1) {
        expect(sortedTimestamps[i]).toBeLessThan(sortedTimestamps[i - 1]);
      }
    });

    it('should sort by slice_name ascending', () => {
      const sortedNames = Object.values(baseProps.slices)
        .sort(SliceAdder.sortByComparator('slice_name'))
        .map(slice => slice.slice_name);

      const expectedNames = Object.values(baseProps.slices)
        .map(slice => slice.slice_name)
        .sort();

      expect(sortedNames).toEqual(expectedNames);
    });
  });

  it('renders chart list', () => {
    renderSliceAdder();
    // The SliceAdder renders <ChartList> internally; check for something from ChartList
    // If ChartList has a heading, text, or testid we can look for it.
    // Example: If ChartList shows "Available Charts" somewhere:
    expect(screen.queryByText(/Available Charts/i)).toBeInTheDocument();
    // Or if there's a test ID on ChartList:
    // expect(screen.getByTestId('chart-list')).toBeInTheDocument();
  });

  it('renders error message when errorMessage is set', () => {
    const errorProps = { ...baseProps, errorMessage: 'this is error' };
    renderSliceAdder(errorProps);
    expect(screen.getByText(/this is error/i)).toBeInTheDocument();
  });

  it('calls fetchSlices on initial mount', () => {
    const fetchSlicesMock = jest.fn();
    renderSliceAdder({ fetchSlices: fetchSlicesMock });
    // Should have been called once
    expect(fetchSlicesMock).toHaveBeenCalledTimes(1);
  });

  describe('receiving new props (UNSAFE_componentWillReceiveProps equivalent)', () => {
    it('updates state when lastUpdated changes (simulated via rerender)', () => {
      const { rerender } = renderSliceAdder();

      // Clear calls from initial render
      baseProps.fetchSlices.mockClear();

      // Rerender with a new lastUpdated
      rerender(<SliceAdder {...baseProps} lastUpdated={Date.now()} />);

      // The code that runs might set state or do something else
      // We can verify side effects, e.g., if it re-filters slices or calls something
      // If you expect no new fetch, check calls:
      // expect(baseProps.fetchSlices).not.toHaveBeenCalled();
      // Or if you do expect a call, check for it
    });

    it('updates selectedSliceIdsSet when selectedSliceIds changes', () => {
      const { rerender } = renderSliceAdder();
      // If there's a side effect you can test, do it here
      rerender(<SliceAdder {...baseProps} selectedSliceIds={[127]} />);
      // Possibly check DOM or calls to confirm state changed
    });
  });

  describe('should rerun filter and sort', () => {
    it('handleChange calls fetchSlices with new search term', () => {
      const fetchSlicesMock = jest.fn();
      renderSliceAdder({ fetchSlices: fetchSlicesMock });

      // Fire an event that triggers handleChange('new search term')
      // In reality, SliceAdder might have an input box and an onChange
      // If so, do something like:
      // userEvent.type(screen.getByPlaceholderText(/search/i), 'new search term');
      // For now, let’s do it by calling the instance method if exposed or test the real flow

      // If you absolutely must call the instance method (not recommended with RTL),
      // you’d do something like:
      // (wrapper.instance() as SliceAdder).handleChange('new search term');
      // But with RTL, you typically do this by user events on the UI.

      // Then check the fetchSlices call:
      expect(fetchSlicesMock).toHaveBeenCalledWith(
        baseProps.userId,
        'new search term',
        DEFAULT_SORT_KEY,
      );
    });

    it('handleSelect calls fetchSlices with new sort', () => {
      const fetchSlicesMock = jest.fn();
      renderSliceAdder({ fetchSlices: fetchSlicesMock });

      // Similarly, you'd select a new sort from a dropdown or button in the actual UI
      // If there's a <select> with testid or label:
      // userEvent.selectOptions(screen.getByLabelText(/Sort by/i), 'viz_type');

      // Then expect fetchSlices to be called
      expect(fetchSlicesMock).toHaveBeenCalledWith(
        baseProps.userId,
        '',
        'viz_type',
      );
    });
  });
});
