/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { renderHook, act } from '@testing-library/react';
import { useDrillDownNavigation } from 'src/features/datasets/relationships/drillDownNavigation';
import type { DrillDownHierarchy } from 'src/features/datasets/relationships/types';

const mockHierarchy: DrillDownHierarchy = {
  id: 'geo',
  name: 'Geography',
  levels: [
    { dataset_id: 1, column_name: 'country', label: 'Country' },
    { dataset_id: 1, column_name: 'state', label: 'State' },
    { dataset_id: 1, column_name: 'city', label: 'City' },
  ],
};

describe('useDrillDownNavigation', () => {
  it('initializes with null state', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(null),
    );
    expect(result.current.state).toBeNull();
  });

  it('initDrillDown sets initial state', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    expect(result.current.state).not.toBeNull();
    expect(result.current.state?.currentLevelIndex).toBe(0);
    expect(result.current.state?.breadcrumbs).toHaveLength(0);
    expect(result.current.currentLevel?.column_name).toBe('country');
  });

  it('drillDown navigates one level deeper', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    act(() => {
      result.current.drillDown('Brazil');
    });

    expect(result.current.state?.currentLevelIndex).toBe(1);
    expect(result.current.state?.breadcrumbs).toHaveLength(1);
    expect(result.current.state?.breadcrumbs[0].value).toBe('Brazil');
    expect(result.current.currentLevel?.column_name).toBe('state');
  });

  it('drillDown builds filter for next level', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    act(() => {
      result.current.drillDown('Brazil');
    });

    expect(result.current.state?.currentFilter).toEqual({
      datasetId: 1,
      column: 'state',
      values: ['Brazil'],
    });
  });

  it('drillUp navigates back to target level', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    act(() => {
      result.current.drillDown('Brazil');
    });

    act(() => {
      result.current.drillDown('SP');
    });

    expect(result.current.state?.currentLevelIndex).toBe(2);

    act(() => {
      result.current.drillUp(0);
    });

    expect(result.current.state?.currentLevelIndex).toBe(0);
    expect(result.current.state?.breadcrumbs).toHaveLength(0);
    expect(result.current.state?.currentFilter).toBeNull();
  });

  it('reset goes back to top level', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    act(() => {
      result.current.drillDown('Brazil');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state?.currentLevelIndex).toBe(0);
    expect(result.current.state?.breadcrumbs).toHaveLength(0);
  });

  it('canDrillDown is false at last level', () => {
    const { result } = renderHook(() =>
      useDrillDownNavigation(mockHierarchy),
    );

    act(() => {
      result.current.initDrillDown(mockHierarchy);
    });

    act(() => {
      result.current.drillDown('Brazil');
    });

    act(() => {
      result.current.drillDown('SP');
    });

    expect(result.current.canDrillDown).toBe(false);
  });
});
