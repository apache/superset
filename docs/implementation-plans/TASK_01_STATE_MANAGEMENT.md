# Task 1: Create Real-Time Dashboard Context & State Management

## Overview

Create the foundational state management for real-time dashboard features, including new Redux state fields, actions, reducers, selectors, and a custom hook to encapsulate real-time dashboard logic.

## Current Implementation

### Existing Dashboard State Structure

**File:** `superset-frontend/src/dashboard/types.ts` (lines 100-132)

```typescript
export type DashboardState = {
  preselectNativeFilters?: JsonObject;
  editMode: boolean;
  isPublished: boolean;
  directPathToChild: string[];
  activeTabs: ActiveTabs;
  fullSizeChartId: number | null;
  isRefreshing: boolean;              // ← Exists but limited
  isFiltersRefreshing: boolean;       // ← Exists but limited
  hasUnsavedChanges: boolean;
  dashboardIsSaving: boolean;
  colorScheme: string;
  sliceIds: number[];
  // ... other fields
};
```

### Existing Refresh-Related Actions

**File:** `superset-frontend/src/dashboard/actions/dashboardState.js`

| Action | Purpose |
|--------|---------|
| `SET_REFRESH_FREQUENCY` | Sets the auto-refresh interval |
| `ON_REFRESH` | Marks refresh as started, stores timestamp |
| `ON_REFRESH_SUCCESS` | Marks refresh as complete |
| `ON_FILTERS_REFRESH` | Marks filter refresh as started |
| `ON_FILTERS_REFRESH_SUCCESS` | Marks filter refresh as complete |

### Existing Reducer Handlers

**File:** `superset-frontend/src/dashboard/reducers/dashboardState.js`

```javascript
[SET_REFRESH_FREQUENCY]() {
  return {
    ...state,
    refreshFrequency: action.refreshFrequency,
    shouldPersistRefreshFrequency: action.isPersistent,
    hasUnsavedChanges: action.isPersistent,
  };
},
[ON_REFRESH]() {
  return {
    ...state,
    isRefreshing: true,
    lastRefreshTime: Date.now(),
  };
},
[ON_REFRESH_SUCCESS]() {
  return {
    ...state,
    isRefreshing: false,
  };
},
```

### State Initialization (Hydration)

**File:** `superset-frontend/src/dashboard/actions/hydrate.js` (lines 288-315)

```javascript
dashboardState: {
  // ...
  refreshFrequency: metadata?.refresh_frequency || 0,
  isRefreshing: false,
  isFiltersRefreshing: false,
  // ...
}
```

## Implementation Plan

### Step 1: Define New Types

**File to modify:** `superset-frontend/src/dashboard/types.ts`

Add the following enum and extend `DashboardState`:

```typescript
/**
 * Status of the auto-refresh cycle for real-time dashboards.
 * Used to drive the status indicator UI and manage refresh state.
 */
export enum AutoRefreshStatus {
  /** No refresh in progress, last refresh was successful */
  Idle = 'idle',
  /** Currently fetching data from the server */
  Fetching = 'fetching',
  /** Refresh completed successfully */
  Success = 'success',
  /** Refresh is taking longer than expected */
  Delayed = 'delayed',
  /** Refresh failed with an error */
  Error = 'error',
  /** Auto-refresh is paused (manually or due to tab visibility) */
  Paused = 'paused',
}

export type DashboardState = {
  // ... existing fields ...

  // New real-time dashboard fields
  /** Current status of the auto-refresh cycle */
  autoRefreshStatus: AutoRefreshStatus;
  /** Whether auto-refresh has been manually paused by the user */
  autoRefreshPaused: boolean;
  /** Whether auto-refresh is paused due to tab being inactive */
  autoRefreshPausedByTab: boolean;
  /** Timestamp of the last successful refresh */
  lastSuccessfulRefresh: number | null;
  /** Error message from the last failed refresh */
  lastRefreshError: string | null;
  /** Count of consecutive refresh errors (for delayed vs error status) */
  refreshErrorCount: number;
};
```

**Location:** Add after line 132, before `DashboardInfo` type.

### Step 2: Create New Actions

**File to modify:** `superset-frontend/src/dashboard/actions/dashboardState.js`

Add the following action types and creators:

```javascript
// Action types
export const SET_AUTO_REFRESH_STATUS = 'SET_AUTO_REFRESH_STATUS';
export const SET_AUTO_REFRESH_PAUSED = 'SET_AUTO_REFRESH_PAUSED';
export const SET_AUTO_REFRESH_PAUSED_BY_TAB = 'SET_AUTO_REFRESH_PAUSED_BY_TAB';
export const SET_LAST_SUCCESSFUL_REFRESH = 'SET_LAST_SUCCESSFUL_REFRESH';
export const SET_REFRESH_ERROR = 'SET_REFRESH_ERROR';
export const CLEAR_REFRESH_ERROR = 'CLEAR_REFRESH_ERROR';
export const INCREMENT_REFRESH_ERROR_COUNT = 'INCREMENT_REFRESH_ERROR_COUNT';
export const RESET_REFRESH_ERROR_COUNT = 'RESET_REFRESH_ERROR_COUNT';

// Action creators
export function setAutoRefreshStatus(status) {
  return { type: SET_AUTO_REFRESH_STATUS, status };
}

export function setAutoRefreshPaused(paused) {
  return { type: SET_AUTO_REFRESH_PAUSED, paused };
}

export function setAutoRefreshPausedByTab(paused) {
  return { type: SET_AUTO_REFRESH_PAUSED_BY_TAB, paused };
}

export function setLastSuccessfulRefresh(timestamp) {
  return { type: SET_LAST_SUCCESSFUL_REFRESH, timestamp };
}

export function setRefreshError(error) {
  return { type: SET_REFRESH_ERROR, error };
}

export function clearRefreshError() {
  return { type: CLEAR_REFRESH_ERROR };
}

export function incrementRefreshErrorCount() {
  return { type: INCREMENT_REFRESH_ERROR_COUNT };
}

export function resetRefreshErrorCount() {
  return { type: RESET_REFRESH_ERROR_COUNT };
}
```

**Location:** Add after line 92 (after existing action imports/exports).

### Step 3: Update the Reducer

**File to modify:** `superset-frontend/src/dashboard/reducers/dashboardState.js`

First, add imports for the new action types (around line 33):

```javascript
import {
  // ... existing imports ...
  SET_AUTO_REFRESH_STATUS,
  SET_AUTO_REFRESH_PAUSED,
  SET_AUTO_REFRESH_PAUSED_BY_TAB,
  SET_LAST_SUCCESSFUL_REFRESH,
  SET_REFRESH_ERROR,
  CLEAR_REFRESH_ERROR,
  INCREMENT_REFRESH_ERROR_COUNT,
  RESET_REFRESH_ERROR_COUNT,
} from '../actions/dashboardState';
```

Then add the action handlers inside the `actionHandlers` object (after line 335):

```javascript
[SET_AUTO_REFRESH_STATUS]() {
  return {
    ...state,
    autoRefreshStatus: action.status,
  };
},
[SET_AUTO_REFRESH_PAUSED]() {
  return {
    ...state,
    autoRefreshPaused: action.paused,
  };
},
[SET_AUTO_REFRESH_PAUSED_BY_TAB]() {
  return {
    ...state,
    autoRefreshPausedByTab: action.paused,
  };
},
[SET_LAST_SUCCESSFUL_REFRESH]() {
  return {
    ...state,
    lastSuccessfulRefresh: action.timestamp,
  };
},
[SET_REFRESH_ERROR]() {
  return {
    ...state,
    lastRefreshError: action.error,
  };
},
[CLEAR_REFRESH_ERROR]() {
  return {
    ...state,
    lastRefreshError: null,
  };
},
[INCREMENT_REFRESH_ERROR_COUNT]() {
  return {
    ...state,
    refreshErrorCount: (state.refreshErrorCount || 0) + 1,
  };
},
[RESET_REFRESH_ERROR_COUNT]() {
  return {
    ...state,
    refreshErrorCount: 0,
  };
},
```

### Step 4: Update Hydration to Initialize New Fields

**File to modify:** `superset-frontend/src/dashboard/actions/hydrate.js`

Import the `AutoRefreshStatus` enum:

```javascript
import { FilterBarOrientation, AutoRefreshStatus } from '../types';
```

Update the `dashboardState` initialization (around line 288-315):

```javascript
dashboardState: {
  // ... existing fields ...

  // New real-time dashboard fields
  autoRefreshStatus: AutoRefreshStatus.Idle,
  autoRefreshPaused: false,
  autoRefreshPausedByTab: false,
  lastSuccessfulRefresh: null,
  lastRefreshError: null,
  refreshErrorCount: 0,
},
```

### Step 5: Create Selectors

**File to create:** `superset-frontend/src/dashboard/selectors/autoRefreshSelectors.ts`

```typescript
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
import { RootState, AutoRefreshStatus } from '../types';

/**
 * Returns true if the dashboard has an auto-refresh interval configured.
 * Any dashboard with refreshFrequency > 0 is considered a "real-time dashboard"
 * and will receive the real-time UI optimizations.
 */
export const selectIsRealTimeDashboard = (state: RootState): boolean =>
  (state.dashboardState.refreshFrequency ?? 0) > 0;

/**
 * Returns the current refresh frequency in seconds (0 = disabled).
 */
export const selectRefreshFrequency = (state: RootState): number =>
  state.dashboardState.refreshFrequency ?? 0;

/**
 * Returns the current auto-refresh status.
 */
export const selectAutoRefreshStatus = (state: RootState): AutoRefreshStatus =>
  state.dashboardState.autoRefreshStatus ?? AutoRefreshStatus.Idle;

/**
 * Returns whether auto-refresh is manually paused by the user.
 */
export const selectAutoRefreshPaused = (state: RootState): boolean =>
  state.dashboardState.autoRefreshPaused ?? false;

/**
 * Returns whether auto-refresh is paused due to inactive tab.
 */
export const selectAutoRefreshPausedByTab = (state: RootState): boolean =>
  state.dashboardState.autoRefreshPausedByTab ?? false;

/**
 * Returns whether auto-refresh is currently paused (either manually or by tab).
 */
export const selectIsAutoRefreshPaused = (state: RootState): boolean =>
  selectAutoRefreshPaused(state) || selectAutoRefreshPausedByTab(state);

/**
 * Returns the timestamp of the last successful refresh, or null if none.
 */
export const selectLastSuccessfulRefresh = (state: RootState): number | null =>
  state.dashboardState.lastSuccessfulRefresh ?? null;

/**
 * Returns the error message from the last failed refresh, or null.
 */
export const selectLastRefreshError = (state: RootState): string | null =>
  state.dashboardState.lastRefreshError ?? null;

/**
 * Returns the count of consecutive refresh errors.
 */
export const selectRefreshErrorCount = (state: RootState): number =>
  state.dashboardState.refreshErrorCount ?? 0;

/**
 * Returns whether the dashboard is currently in a refreshing/fetching state.
 * This considers both the legacy isRefreshing flag and the new autoRefreshStatus.
 */
export const selectIsRefreshing = (state: RootState): boolean =>
  state.dashboardState.isRefreshing ||
  state.dashboardState.autoRefreshStatus === AutoRefreshStatus.Fetching;

/**
 * Derives the effective display status based on error count thresholds.
 * - 0 errors: Success/Idle
 * - 1-2 errors: Delayed (yellow warning)
 * - 3+ errors: Error (red)
 */
export const selectEffectiveRefreshStatus = (
  state: RootState,
): AutoRefreshStatus => {
  const status = selectAutoRefreshStatus(state);
  const errorCount = selectRefreshErrorCount(state);
  const isPaused = selectIsAutoRefreshPaused(state);

  if (isPaused) {
    return AutoRefreshStatus.Paused;
  }

  if (status === AutoRefreshStatus.Fetching) {
    return AutoRefreshStatus.Fetching;
  }

  if (errorCount >= 3) {
    return AutoRefreshStatus.Error;
  }

  if (errorCount >= 1) {
    return AutoRefreshStatus.Delayed;
  }

  return AutoRefreshStatus.Success;
};
```

### Step 6: Create Custom Hook

**File to create:** `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.ts`

```typescript
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
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import { AutoRefreshStatus } from '../types';
import {
  setAutoRefreshStatus,
  setAutoRefreshPaused,
  setAutoRefreshPausedByTab,
  setLastSuccessfulRefresh,
  setRefreshError,
  clearRefreshError,
  incrementRefreshErrorCount,
  resetRefreshErrorCount,
} from '../actions/dashboardState';
import {
  selectIsRealTimeDashboard,
  selectRefreshFrequency,
  selectAutoRefreshStatus,
  selectAutoRefreshPaused,
  selectAutoRefreshPausedByTab,
  selectIsAutoRefreshPaused,
  selectLastSuccessfulRefresh,
  selectLastRefreshError,
  selectRefreshErrorCount,
  selectEffectiveRefreshStatus,
  selectIsRefreshing,
} from '../selectors/autoRefreshSelectors';

export interface UseRealTimeDashboardResult {
  /** Whether this dashboard has auto-refresh enabled (refreshFrequency > 0) */
  isRealTimeDashboard: boolean;
  /** The auto-refresh interval in seconds */
  refreshFrequency: number;
  /** Current status of the auto-refresh cycle */
  status: AutoRefreshStatus;
  /** Effective status considering error thresholds and pause state */
  effectiveStatus: AutoRefreshStatus;
  /** Whether auto-refresh is manually paused */
  isPaused: boolean;
  /** Whether auto-refresh is paused due to inactive tab */
  isPausedByTab: boolean;
  /** Whether auto-refresh is paused (either manually or by tab) */
  isAnyPaused: boolean;
  /** Timestamp of the last successful refresh */
  lastSuccessfulRefresh: number | null;
  /** Error message from the last failed refresh */
  lastError: string | null;
  /** Count of consecutive errors */
  errorCount: number;
  /** Whether any refresh is in progress */
  isRefreshing: boolean;

  // Actions
  /** Set the auto-refresh status */
  setStatus: (status: AutoRefreshStatus) => void;
  /** Toggle manual pause state */
  togglePause: () => void;
  /** Set manual pause state */
  setPaused: (paused: boolean) => void;
  /** Set tab-based pause state */
  setPausedByTab: (paused: boolean) => void;
  /** Record a successful refresh */
  recordSuccess: () => void;
  /** Record a failed refresh with error message */
  recordError: (error: string) => void;
  /** Clear the last error */
  clearError: () => void;
}

/**
 * Custom hook that encapsulates all real-time dashboard state and logic.
 * Use this hook in components that need to interact with real-time dashboard features.
 */
export function useRealTimeDashboard(): UseRealTimeDashboardResult {
  const dispatch = useDispatch();

  // Selectors
  const isRealTimeDashboard = useSelector(selectIsRealTimeDashboard);
  const refreshFrequency = useSelector(selectRefreshFrequency);
  const status = useSelector(selectAutoRefreshStatus);
  const effectiveStatus = useSelector(selectEffectiveRefreshStatus);
  const isPaused = useSelector(selectAutoRefreshPaused);
  const isPausedByTab = useSelector(selectAutoRefreshPausedByTab);
  const isAnyPaused = useSelector(selectIsAutoRefreshPaused);
  const lastSuccessfulRefresh = useSelector(selectLastSuccessfulRefresh);
  const lastError = useSelector(selectLastRefreshError);
  const errorCount = useSelector(selectRefreshErrorCount);
  const isRefreshing = useSelector(selectIsRefreshing);

  // Bound action creators
  const boundActions = useMemo(
    () =>
      bindActionCreators(
        {
          setAutoRefreshStatus,
          setAutoRefreshPaused,
          setAutoRefreshPausedByTab,
          setLastSuccessfulRefresh,
          setRefreshError,
          clearRefreshError,
          incrementRefreshErrorCount,
          resetRefreshErrorCount,
        },
        dispatch,
      ),
    [dispatch],
  );

  // Action handlers
  const setStatus = useCallback(
    (newStatus: AutoRefreshStatus) => {
      boundActions.setAutoRefreshStatus(newStatus);
    },
    [boundActions],
  );

  const togglePause = useCallback(() => {
    boundActions.setAutoRefreshPaused(!isPaused);
  }, [boundActions, isPaused]);

  const setPaused = useCallback(
    (paused: boolean) => {
      boundActions.setAutoRefreshPaused(paused);
    },
    [boundActions],
  );

  const setPausedByTab = useCallback(
    (paused: boolean) => {
      boundActions.setAutoRefreshPausedByTab(paused);
    },
    [boundActions],
  );

  const recordSuccess = useCallback(() => {
    boundActions.setAutoRefreshStatus(AutoRefreshStatus.Success);
    boundActions.setLastSuccessfulRefresh(Date.now());
    boundActions.resetRefreshErrorCount();
    boundActions.clearRefreshError();
  }, [boundActions]);

  const recordError = useCallback(
    (error: string) => {
      boundActions.setAutoRefreshStatus(AutoRefreshStatus.Error);
      boundActions.setRefreshError(error);
      boundActions.incrementRefreshErrorCount();
    },
    [boundActions],
  );

  const clearError = useCallback(() => {
    boundActions.clearRefreshError();
  }, [boundActions]);

  return {
    isRealTimeDashboard,
    refreshFrequency,
    status,
    effectiveStatus,
    isPaused,
    isPausedByTab,
    isAnyPaused,
    lastSuccessfulRefresh,
    lastError,
    errorCount,
    isRefreshing,
    setStatus,
    togglePause,
    setPaused,
    setPausedByTab,
    recordSuccess,
    recordError,
    clearError,
  };
}
```

### Step 7: Create Unit Tests

**File to create:** `superset-frontend/src/dashboard/selectors/autoRefreshSelectors.test.ts`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { AutoRefreshStatus, RootState } from '../types';
import {
  selectIsRealTimeDashboard,
  selectAutoRefreshStatus,
  selectEffectiveRefreshStatus,
  selectIsAutoRefreshPaused,
} from './autoRefreshSelectors';

const createMockState = (
  dashboardStateOverrides: Partial<RootState['dashboardState']> = {},
): RootState =>
  ({
    dashboardState: {
      refreshFrequency: 0,
      autoRefreshStatus: AutoRefreshStatus.Idle,
      autoRefreshPaused: false,
      autoRefreshPausedByTab: false,
      lastSuccessfulRefresh: null,
      lastRefreshError: null,
      refreshErrorCount: 0,
      isRefreshing: false,
      ...dashboardStateOverrides,
    },
  }) as RootState;

describe('autoRefreshSelectors', () => {
  describe('selectIsRealTimeDashboard', () => {
    test('returns false when refreshFrequency is 0', () => {
      const state = createMockState({ refreshFrequency: 0 });
      expect(selectIsRealTimeDashboard(state)).toBe(false);
    });

    test('returns true when refreshFrequency is greater than 0', () => {
      const state = createMockState({ refreshFrequency: 5 });
      expect(selectIsRealTimeDashboard(state)).toBe(true);
    });
  });

  describe('selectAutoRefreshStatus', () => {
    test('returns the current status', () => {
      const state = createMockState({
        autoRefreshStatus: AutoRefreshStatus.Fetching,
      });
      expect(selectAutoRefreshStatus(state)).toBe(AutoRefreshStatus.Fetching);
    });
  });

  describe('selectIsAutoRefreshPaused', () => {
    test('returns true when manually paused', () => {
      const state = createMockState({ autoRefreshPaused: true });
      expect(selectIsAutoRefreshPaused(state)).toBe(true);
    });

    test('returns true when paused by tab', () => {
      const state = createMockState({ autoRefreshPausedByTab: true });
      expect(selectIsAutoRefreshPaused(state)).toBe(true);
    });

    test('returns false when not paused', () => {
      const state = createMockState();
      expect(selectIsAutoRefreshPaused(state)).toBe(false);
    });
  });

  describe('selectEffectiveRefreshStatus', () => {
    test('returns Paused when manually paused', () => {
      const state = createMockState({ autoRefreshPaused: true });
      expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Paused);
    });

    test('returns Fetching when fetching', () => {
      const state = createMockState({
        autoRefreshStatus: AutoRefreshStatus.Fetching,
      });
      expect(selectEffectiveRefreshStatus(state)).toBe(
        AutoRefreshStatus.Fetching,
      );
    });

    test('returns Delayed when 1-2 errors', () => {
      const state = createMockState({ refreshErrorCount: 2 });
      expect(selectEffectiveRefreshStatus(state)).toBe(
        AutoRefreshStatus.Delayed,
      );
    });

    test('returns Error when 3+ errors', () => {
      const state = createMockState({ refreshErrorCount: 3 });
      expect(selectEffectiveRefreshStatus(state)).toBe(AutoRefreshStatus.Error);
    });

    test('returns Success when no errors', () => {
      const state = createMockState({ refreshErrorCount: 0 });
      expect(selectEffectiveRefreshStatus(state)).toBe(
        AutoRefreshStatus.Success,
      );
    });
  });
});
```

**File to create:** `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.test.ts`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { ReactNode } from 'react';
import { useRealTimeDashboard } from './useRealTimeDashboard';
import { AutoRefreshStatus } from '../types';

const createMockStore = (initialState = {}) =>
  createStore(() => ({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Idle,
      autoRefreshPaused: false,
      autoRefreshPausedByTab: false,
      lastSuccessfulRefresh: null,
      lastRefreshError: null,
      refreshErrorCount: 0,
      isRefreshing: false,
      ...initialState,
    },
  }));

const createWrapper =
  (store: ReturnType<typeof createMockStore>) =>
  ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

describe('useRealTimeDashboard', () => {
  test('returns isRealTimeDashboard true when refreshFrequency > 0', () => {
    const store = createMockStore({ refreshFrequency: 5 });
    const { result } = renderHook(() => useRealTimeDashboard(), {
      wrapper: createWrapper(store),
    });
    expect(result.current.isRealTimeDashboard).toBe(true);
  });

  test('returns isRealTimeDashboard false when refreshFrequency is 0', () => {
    const store = createMockStore({ refreshFrequency: 0 });
    const { result } = renderHook(() => useRealTimeDashboard(), {
      wrapper: createWrapper(store),
    });
    expect(result.current.isRealTimeDashboard).toBe(false);
  });

  test('returns correct status', () => {
    const store = createMockStore({
      autoRefreshStatus: AutoRefreshStatus.Fetching,
    });
    const { result } = renderHook(() => useRealTimeDashboard(), {
      wrapper: createWrapper(store),
    });
    expect(result.current.status).toBe(AutoRefreshStatus.Fetching);
  });
});
```

## File Summary

### Files to Create
| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/selectors/autoRefreshSelectors.ts` | Redux selectors for real-time state |
| `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.ts` | Custom hook encapsulating real-time logic |
| `superset-frontend/src/dashboard/selectors/autoRefreshSelectors.test.ts` | Unit tests for selectors |
| `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.test.ts` | Unit tests for hook |

### Files to Modify
| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/types.ts` | Add `AutoRefreshStatus` enum and extend `DashboardState` |
| `superset-frontend/src/dashboard/actions/dashboardState.js` | Add new action types and creators |
| `superset-frontend/src/dashboard/reducers/dashboardState.js` | Add new action handlers |
| `superset-frontend/src/dashboard/actions/hydrate.js` | Initialize new state fields |

## Integration Notes

### Usage in Header Component

After implementing this task, the Header component can use the hook like this:

```typescript
// In Header/index.jsx
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';

const Header = () => {
  const {
    isRealTimeDashboard,
    effectiveStatus,
    isPaused,
    togglePause,
    recordSuccess,
    recordError,
  } = useRealTimeDashboard();

  // Use in periodic render callback
  const periodicRender = useCallback(() => {
    realTimeDashboard.setStatus(AutoRefreshStatus.Fetching);
    return fetchCharts(affectedCharts, true)
      .then(() => realTimeDashboard.recordSuccess())
      .catch((error) => realTimeDashboard.recordError(error.message));
  }, [/* deps */]);

  // ...
};
```

### TypeScript Considerations

Since `dashboardState.js` and `hydrate.js` are JavaScript files, the TypeScript types won't provide compile-time checking. However:
1. The types serve as documentation
2. Components consuming the state via TypeScript hooks/selectors will get type safety
3. Consider migrating these files to TypeScript in the future

## Dependencies

- No new npm packages required
- Uses existing Redux, react-redux patterns
- Compatible with existing Superset architecture

## Testing Strategy

1. **Unit tests** for selectors (pure functions, easy to test)
2. **Unit tests** for hook using `@testing-library/react-hooks`
3. **Reducer tests** can be added to existing reducer test file
4. Integration with Header component tested in Task 2+
