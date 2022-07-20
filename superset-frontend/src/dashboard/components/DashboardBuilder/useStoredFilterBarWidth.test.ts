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
import { renderHook, act } from '@testing-library/react-hooks';
import {
  LocalStorageKeys,
  setItem,
  getItem,
} from 'src/utils/localStorageHelpers';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import useStoredFilterBarWidth from './useStoredFilterBarWidth';

describe('useStoredFilterBarWidth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it('returns a default filterBar width by OPEN_FILTER_BAR_WIDTH', () => {
    const dashboardId = '123';
    const { result } = renderHook(() => useStoredFilterBarWidth(dashboardId));
    const [actualWidth] = result.current;

    expect(actualWidth).toEqual(OPEN_FILTER_BAR_WIDTH);
  });

  it('returns a stored filterBar width from localStorage', () => {
    const dashboardId = '123';
    const expectedWidth = 378;
    setItem(LocalStorageKeys.dashboard__custom_filter_bar_widths, {
      [dashboardId]: expectedWidth,
      '456': 250,
    });
    const { result } = renderHook(() => useStoredFilterBarWidth(dashboardId));
    const [actualWidth] = result.current;

    expect(actualWidth).toEqual(expectedWidth);
    expect(actualWidth).not.toEqual(250);
  });

  it('returns a setter for filterBar width that stores the state in localStorage together', () => {
    const dashboardId = '123';
    const expectedWidth = 378;
    const otherDashboardId = '456';
    const otherDashboardWidth = 253;
    setItem(LocalStorageKeys.dashboard__custom_filter_bar_widths, {
      [dashboardId]: 300,
      [otherDashboardId]: otherDashboardWidth,
    });
    const { result } = renderHook(() => useStoredFilterBarWidth(dashboardId));
    const [prevWidth, setter] = result.current;

    expect(prevWidth).toEqual(300);

    act(() => setter(expectedWidth));

    const updatedWidth = result.current[0];
    const widthsMap = getItem(
      LocalStorageKeys.dashboard__custom_filter_bar_widths,
      {},
    );
    expect(widthsMap[dashboardId]).toEqual(expectedWidth);
    expect(widthsMap[otherDashboardId]).toEqual(otherDashboardWidth);
    expect(updatedWidth).toEqual(expectedWidth);
    expect(updatedWidth).not.toEqual(250);
  });
});
