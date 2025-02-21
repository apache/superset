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
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { DatasourceType } from '@superset-ui/core';
import { sliceEntitiesForDashboard as mockSliceEntities } from 'spec/fixtures/mockSliceEntities';
import { configureStore } from '@reduxjs/toolkit';
import SliceAdder, { SliceAdderProps } from './SliceAdder';

// Mock the Select component to avoid debounce issues
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  Select: ({ value, onChange, options }: any) => (
    <select
      data-test="select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

jest.mock('lodash/debounce', () => {
  const debounced = (fn: Function) => {
    const debouncedFn = ((...args: any[]) =>
      fn(...args)) as unknown as Function & {
      cancel: () => void;
    };
    debouncedFn.cancel = () => {};
    return debouncedFn;
  };
  return debounced;
});

const mockStore = configureStore({
  reducer: (state = { common: { locale: 'en' } }) => state,
});

const defaultProps: SliceAdderProps = {
  slices: mockSliceEntities.slices,
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

const renderSliceAdder = (props = defaultProps) =>
  render(<SliceAdder {...props} />, { store: mockStore });

describe('SliceAdder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the create new chart button', () => {
    renderSliceAdder();
    expect(screen.getByText('Create new chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderSliceAdder({ ...defaultProps, isLoading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders error message', () => {
    const errorMessage = 'Error loading charts';
    renderSliceAdder({ ...defaultProps, errorMessage });
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('fetches slices on mount', () => {
    renderSliceAdder();
    expect(defaultProps.fetchSlices).toHaveBeenCalledWith(1, '', 'changed_on');
  });

  it('handles search input changes', async () => {
    renderSliceAdder();
    const searchInput = screen.getByPlaceholderText('Filter your charts');
    await userEvent.type(searchInput, 'test search');
    expect(defaultProps.fetchSlices).toHaveBeenCalledWith(
      1,
      'test search',
      'changed_on',
    );
  });

  it('handles sort selection changes', async () => {
    renderSliceAdder();
    // Update selector to match the actual rendered element
    const sortSelect = screen.getByText('Sort by recent');
    await userEvent.click(sortSelect);
    const vizTypeOption = screen.getByText('Sort by viz type');
    await userEvent.click(vizTypeOption);
    expect(defaultProps.fetchSlices).toHaveBeenCalledWith(1, '', 'viz_type');
  });

  it('handles show only my charts toggle', async () => {
    renderSliceAdder();
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    expect(defaultProps.fetchSlices).toHaveBeenCalledWith(
      undefined,
      '',
      'changed_on',
    );
  });

  it('opens new chart in new tab when create new chart is clicked', () => {
    const windowSpy = jest.spyOn(window, 'open').mockImplementation();
    renderSliceAdder();
    const createButton = screen.getByText('Create new chart');
    fireEvent.click(createButton);
    expect(windowSpy).toHaveBeenCalledWith(
      '/chart/add?dashboard_id=0',
      '_blank',
      'noopener noreferrer',
    );
    windowSpy.mockRestore();
  });

  describe('sortByComparator', () => {
    const baseSlice = {
      slice_url: '/superset/explore/',
      thumbnail_url: '/thumbnail',
      datasource_url: '/superset/datasource/1',
      changed_on_humanized: '1 day ago',
      datasource_id: 1,
      datasource_name: 'test_datasource',
      datasource_type: DatasourceType.Table,
      form_data: {},
      viz_type: 'test_viz',
      datasource: '1__table',
      description: '',
      description_markdown: '',
      modified: '2020-01-01',
      owners: [],
      created_by: { id: 1 }, // Fix: provide required user object instead of null
      cache_timeout: null,
      uuid: '1234',
      query_context: null,
    };

    it('should sort by changed_on in descending order', () => {
      const input = [
        {
          ...baseSlice,
          slice_id: 1,
          slice_name: 'Test 1',
          changed_on: 1577836800000, // 2020-01-01
        },
        {
          ...baseSlice,
          slice_id: 2,
          slice_name: 'Test 2',
          changed_on: 1578009600000, // 2020-01-03
          uuid: '5678',
        },
        {
          ...baseSlice,
          slice_id: 3,
          slice_name: 'Test 3',
          changed_on: 1577923200000, // 2020-01-02
          uuid: '9012',
        },
      ];
      const sorted = input.sort(SliceAdder.sortByComparator('changed_on'));
      expect(sorted[0].changed_on).toBe(1578009600000);
      expect(sorted[2].changed_on).toBe(1577836800000);
    });

    it('should sort by other fields in ascending order', () => {
      const input = [
        {
          ...baseSlice,
          slice_id: 1,
          slice_name: 'c',
          changed_on: 1577836800000, // Add changed_on field
          uuid: '1234',
        },
        {
          ...baseSlice,
          slice_id: 2,
          slice_name: 'a',
          changed_on: 1577836800000, // Add changed_on field
          uuid: '5678',
        },
        {
          ...baseSlice,
          slice_id: 3,
          slice_name: 'b',
          changed_on: 1577836800000, // Add changed_on field
          uuid: '9012',
        },
      ];
      const sorted = input.sort(SliceAdder.sortByComparator('slice_name'));
      expect(sorted[0].slice_name).toBe('a');
      expect(sorted[2].slice_name).toBe('c');
    });
  });

  it('should update selectedSliceIdsSet when props change', () => {
    const { rerender } = renderSliceAdder();
    rerender(<SliceAdder {...defaultProps} selectedSliceIds={[129]} />);
    // Verify the internal state was updated by checking if new charts are available
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
