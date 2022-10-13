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
import useStoredSidebarWidth from './useStoredSidebarWidth';

const INITIAL_WIDTH = 300;

describe('useStoredSidebarWidth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  it('returns a default filterBar width by initialWidth', () => {
    const id = '123';
    const { result } = renderHook(() =>
      useStoredSidebarWidth(id, INITIAL_WIDTH),
    );
    const [actualWidth] = result.current;

    expect(actualWidth).toEqual(INITIAL_WIDTH);
  });

  it('returns a stored filterBar width from localStorage', () => {
    const id = '123';
    const expectedWidth = 378;
    setItem(LocalStorageKeys.common__resizable_sidebar_widths, {
      [id]: expectedWidth,
      '456': 250,
    });
    const { result } = renderHook(() =>
      useStoredSidebarWidth(id, INITIAL_WIDTH),
    );
    const [actualWidth] = result.current;

    expect(actualWidth).toEqual(expectedWidth);
    expect(actualWidth).not.toEqual(250);
  });

  it('returns a setter for filterBar width that stores the state in localStorage together', () => {
    const id = '123';
    const expectedWidth = 378;
    const otherDashboardId = '456';
    const otherDashboardWidth = 253;
    setItem(LocalStorageKeys.common__resizable_sidebar_widths, {
      [id]: 300,
      [otherDashboardId]: otherDashboardWidth,
    });
    const { result } = renderHook(() =>
      useStoredSidebarWidth(id, INITIAL_WIDTH),
    );
    const [prevWidth, setter] = result.current;

    expect(prevWidth).toEqual(300);

    act(() => setter(expectedWidth));

    const updatedWidth = result.current[0];
    const widthsMap = getItem(
      LocalStorageKeys.common__resizable_sidebar_widths,
      {},
    );
    expect(widthsMap[id]).toEqual(expectedWidth);
    expect(widthsMap[otherDashboardId]).toEqual(otherDashboardWidth);
    expect(updatedWidth).toEqual(expectedWidth);
    expect(updatedWidth).not.toEqual(250);
  });
});
