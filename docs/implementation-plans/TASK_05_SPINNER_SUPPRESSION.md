# Task 5: Implement Spinner Suppression During Auto-Refresh

## Overview

Hide chart loading spinners during auto-refresh cycles while keeping them for initial load and manual refresh. This creates a smoother visual experience for real-time dashboards by avoiding flickering spinners every 5 seconds.

## Current Implementation

### Chart Loading Flow

```
refreshChart() → postChartFormData() → exploreJSON()
                                         ↓
                          dispatch(chartUpdateStarted())
                                         ↓
                          reducer: chartStatus = 'loading'
                                         ↓
                          Chart.tsx: isLoading = true
                                         ↓
                          renderSpinner() displayed
```

### chartAction.js - CHART_UPDATE_STARTED Action

**File:** `superset-frontend/src/components/Chart/chartAction.js` (lines 47-55)

```javascript
export const CHART_UPDATE_STARTED = 'CHART_UPDATE_STARTED';
export function chartUpdateStarted(queryController, latestQueryFormData, key) {
  return {
    type: CHART_UPDATE_STARTED,
    queryController,
    latestQueryFormData,
    key,
  };
}
```

**Called in exploreJSON** (line 426):
```javascript
dispatch(chartUpdateStarted(controller, formData, key));
```

### chartReducer.ts - Loading State

**File:** `superset-frontend/src/components/Chart/chartReducer.ts` (lines 69-79)

```typescript
[actions.CHART_UPDATE_STARTED](state) {
  return {
    ...state,
    chartStatus: 'loading',  // ← This triggers spinner
    chartStackTrace: null,
    chartAlert: null,
    chartUpdateEndTime: null,
    chartUpdateStartTime: now(),
    queryController: action.queryController,
  };
},
```

### Chart.tsx - Spinner Rendering

**File:** `superset-frontend/src/components/Chart/Chart.tsx` (lines 331, 388-390)

```typescript
const isLoading = chartStatus === 'loading';  // line 331

// line 388-390
{isLoading
  ? this.renderSpinner(databaseName)
  : this.renderChartContainer()}
```

### ChartState Type

**File:** `superset-frontend/src/explore/types.ts` (lines 45-61)

```typescript
export interface ChartState {
  id: number;
  annotationData?: AnnotationData;
  annotationError?: Record<string, string>;
  annotationQuery?: Record<string, AbortController>;
  chartAlert: string | null;
  chartStatus: ChartStatus | null;
  chartStackTrace?: string | null;
  chartUpdateEndTime: number | null;
  chartUpdateStartTime: number;
  lastRendered: number;
  latestQueryFormData: LatestQueryFormData;
  sliceFormData: QueryFormData | null;
  queryController: AbortController | null;
  queriesResponse: QueryData[] | null;
  triggerQuery: boolean;
}
```

## Implementation Plan

### Approach: Dashboard-Level Auto-Refresh Context

Instead of modifying each chart's state individually, use a dashboard-level flag that charts can check. This is cleaner and more maintainable.

### Step 1: Create Auto-Refresh Context

**File to create:** `superset-frontend/src/dashboard/contexts/AutoRefreshContext.tsx`

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
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  FC,
} from 'react';

export interface AutoRefreshContextValue {
  /** Whether an auto-refresh cycle is in progress */
  isAutoRefreshing: boolean;
  /** Set the auto-refresh state */
  setIsAutoRefreshing: (value: boolean) => void;
  /** Mark auto-refresh as started */
  startAutoRefresh: () => void;
  /** Mark auto-refresh as completed */
  endAutoRefresh: () => void;
}

const AutoRefreshContext = createContext<AutoRefreshContextValue>({
  isAutoRefreshing: false,
  setIsAutoRefreshing: () => {},
  startAutoRefresh: () => {},
  endAutoRefresh: () => {},
});

export interface AutoRefreshProviderProps {
  children: ReactNode;
}

/**
 * Provider that tracks whether an auto-refresh cycle is in progress.
 * Charts can use this context to suppress loading spinners during auto-refresh.
 */
export const AutoRefreshProvider: FC<AutoRefreshProviderProps> = ({
  children,
}) => {
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  const startAutoRefresh = useCallback(() => {
    setIsAutoRefreshing(true);
  }, []);

  const endAutoRefresh = useCallback(() => {
    setIsAutoRefreshing(false);
  }, []);

  const value = useMemo(
    () => ({
      isAutoRefreshing,
      setIsAutoRefreshing,
      startAutoRefresh,
      endAutoRefresh,
    }),
    [isAutoRefreshing, startAutoRefresh, endAutoRefresh],
  );

  return (
    <AutoRefreshContext.Provider value={value}>
      {children}
    </AutoRefreshContext.Provider>
  );
};

/**
 * Hook to access the auto-refresh context.
 * Use this in chart components to check if spinners should be suppressed.
 */
export const useAutoRefreshContext = (): AutoRefreshContextValue =>
  useContext(AutoRefreshContext);

/**
 * Hook that returns just the isAutoRefreshing flag.
 * Convenience hook for components that only need to check the flag.
 */
export const useIsAutoRefreshing = (): boolean => {
  const { isAutoRefreshing } = useContext(AutoRefreshContext);
  return isAutoRefreshing;
};
```

### Step 2: Wrap Dashboard with Provider

**File to modify:** `superset-frontend/src/dashboard/containers/DashboardPage.tsx`

Add the provider around the dashboard content:

```typescript
import { AutoRefreshProvider } from '../contexts/AutoRefreshContext';

// In the render/return:
<AutoRefreshProvider>
  {/* existing dashboard content */}
</AutoRefreshProvider>
```

**Alternative location:** If `DashboardPage.tsx` is not the right place, wrap in `Dashboard.jsx`:

**File to modify:** `superset-frontend/src/dashboard/components/Dashboard.jsx`

```javascript
import { AutoRefreshProvider } from '../contexts/AutoRefreshContext';

// In render():
return (
  <AutoRefreshProvider>
    {/* existing dashboard JSX */}
  </AutoRefreshProvider>
);
```

### Step 3: Update Header to Set Auto-Refresh State

**File to modify:** `superset-frontend/src/dashboard/components/Header/index.jsx`

Import and use the context:

```javascript
import { useAutoRefreshContext } from '../../contexts/AutoRefreshContext';

// Inside Header component:
const { startAutoRefresh, endAutoRefresh } = useAutoRefreshContext();
```

Update the `startPeriodicRender` callback to mark auto-refresh:

```javascript
const startPeriodicRender = useCallback(
  interval => {
    // ... existing intervalMessage logic ...

    const periodicRender = () => {
      const { metadata } = dashboardInfo;
      const immune = metadata.timed_refresh_immune_slices || [];
      const affectedCharts = chartIds.filter(
        chartId => immune.indexOf(chartId) === -1,
      );

      // Log event
      boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
        interval,
        chartCount: affectedCharts.length,
      });

      // Mark auto-refresh as starting (suppress spinners)
      startAutoRefresh();
      setStatus(AutoRefreshStatus.Fetching);

      const fetchPromise =
        dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
          ? fetchCharts(affectedCharts)
          : fetchCharts(affectedCharts, true);

      return fetchPromise
        .then(() => {
          recordSuccess();
        })
        .catch(error => {
          recordError(error?.message || 'Refresh failed');
        })
        .finally(() => {
          // Mark auto-refresh as complete (allow spinners again)
          endAutoRefresh();
        });
    };

    refreshTimer.current = setPeriodicRunner({
      interval,
      periodicRender,
      refreshTimer: refreshTimer.current,
    });
  },
  [
    boundActionCreators,
    chartIds,
    dashboardInfo,
    startAutoRefresh,
    endAutoRefresh,
    setStatus,
    recordSuccess,
    recordError,
  ],
);
```

Also update `handleTabVisibilityRefresh` and `handlePauseToggle` (from Tasks 3 & 4) to use the context if they trigger auto-refresh-like behavior.

### Step 4: Update Chart Component to Check Context

**File to modify:** `superset-frontend/src/components/Chart/Chart.tsx`

This is a class component, so we need to either:
1. Convert to functional component (invasive)
2. Create a wrapper functional component
3. Use a HOC or render prop pattern
4. Pass the flag as a prop from the parent

**Option 4 (Recommended):** Pass via props from ChartHolder.

**File to modify:** `superset-frontend/src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx`

Import and use the context:

```typescript
import { useIsAutoRefreshing } from '../../../contexts/AutoRefreshContext';

// Inside ChartHolder component:
const isAutoRefreshing = useIsAutoRefreshing();

// Pass to Chart:
<Chart
  {...chartProps}
  suppressLoadingSpinner={isAutoRefreshing}
/>
```

**Then modify Chart.tsx props:**

```typescript
// Add to Chart props interface
interface ChartProps {
  // ... existing props ...
  /** Whether to suppress the loading spinner (during auto-refresh) */
  suppressLoadingSpinner?: boolean;
}

// In render():
const {
  height,
  chartAlert,
  chartStatus,
  datasource,
  errorMessage,
  chartIsStale,
  queriesResponse = [],
  width,
  suppressLoadingSpinner,  // NEW
} = this.props;

// Update isLoading logic
const isLoading = chartStatus === 'loading';
const showSpinner = isLoading && !suppressLoadingSpinner;  // NEW

// Update render return
{showSpinner
  ? this.renderSpinner(databaseName)
  : this.renderChartContainer()}
```

### Step 5: Ensure Explore Page Works Normally

The Explore page (chart editing) should NOT suppress spinners. Since the context provider is only in the Dashboard, Explore page charts will not have access to the context, and `isAutoRefreshing` will default to `false`, preserving normal spinner behavior.

However, verify that `ChartHolder` handles the case where context is not available:

```typescript
// In ChartHolder.tsx
import { useIsAutoRefreshing } from '../../../contexts/AutoRefreshContext';

const ChartHolder = (props) => {
  // Will return false if not inside provider (e.g., Explore page)
  const isAutoRefreshing = useIsAutoRefreshing();

  return (
    <Chart
      {...props}
      suppressLoadingSpinner={isAutoRefreshing}
    />
  );
};
```

### Step 6: Create Unit Tests

**File to create:** `superset-frontend/src/dashboard/contexts/AutoRefreshContext.test.tsx`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { render, screen, act, renderHook } from '@testing-library/react';
import {
  AutoRefreshProvider,
  useAutoRefreshContext,
  useIsAutoRefreshing,
} from './AutoRefreshContext';

describe('AutoRefreshContext', () => {
  test('provides default values when not inside provider', () => {
    const { result } = renderHook(() => useIsAutoRefreshing());
    expect(result.current).toBe(false);
  });

  test('isAutoRefreshing starts as false', () => {
    const { result } = renderHook(() => useAutoRefreshContext(), {
      wrapper: AutoRefreshProvider,
    });
    expect(result.current.isAutoRefreshing).toBe(false);
  });

  test('startAutoRefresh sets isAutoRefreshing to true', () => {
    const { result } = renderHook(() => useAutoRefreshContext(), {
      wrapper: AutoRefreshProvider,
    });

    act(() => {
      result.current.startAutoRefresh();
    });

    expect(result.current.isAutoRefreshing).toBe(true);
  });

  test('endAutoRefresh sets isAutoRefreshing to false', () => {
    const { result } = renderHook(() => useAutoRefreshContext(), {
      wrapper: AutoRefreshProvider,
    });

    act(() => {
      result.current.startAutoRefresh();
    });
    expect(result.current.isAutoRefreshing).toBe(true);

    act(() => {
      result.current.endAutoRefresh();
    });
    expect(result.current.isAutoRefreshing).toBe(false);
  });
});
```

**File to create:** `superset-frontend/src/components/Chart/Chart.test.tsx` (add test cases)

```typescript
// Add to existing Chart tests:

describe('spinner suppression', () => {
  test('shows spinner when loading and suppressLoadingSpinner is false', () => {
    render(<Chart chartStatus="loading" suppressLoadingSpinner={false} {...defaultProps} />);
    expect(screen.getByText(/Waiting on/)).toBeInTheDocument();
  });

  test('does not show spinner when loading and suppressLoadingSpinner is true', () => {
    render(<Chart chartStatus="loading" suppressLoadingSpinner={true} {...defaultProps} />);
    expect(screen.queryByText(/Waiting on/)).not.toBeInTheDocument();
    expect(screen.getByTestId('slice-container')).toBeInTheDocument();
  });

  test('shows chart container when loading and suppressLoadingSpinner is true', () => {
    render(<Chart chartStatus="loading" suppressLoadingSpinner={true} {...defaultProps} />);
    expect(screen.getByTestId('slice-container')).toBeInTheDocument();
  });
});
```

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/contexts/AutoRefreshContext.tsx` | Context for tracking auto-refresh state |
| `superset-frontend/src/dashboard/contexts/AutoRefreshContext.test.tsx` | Unit tests for context |

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/Dashboard.jsx` or `DashboardPage.tsx` | Wrap with `AutoRefreshProvider` |
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Use context to mark auto-refresh cycles |
| `superset-frontend/src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx` | Pass `suppressLoadingSpinner` prop |
| `superset-frontend/src/components/Chart/Chart.tsx` | Accept and use `suppressLoadingSpinner` prop |

## Behavior Specification

### During Auto-Refresh

1. `startAutoRefresh()` called before `fetchCharts()`
2. Charts receive `suppressLoadingSpinner={true}`
3. Charts show previous data while new data loads
4. `endAutoRefresh()` called in `finally` block
5. Charts re-render with new data (no spinner flash)

### During Manual Refresh

1. Context not modified (stays `isAutoRefreshing: false`)
2. Charts receive `suppressLoadingSpinner={false}`
3. Normal spinner behavior

### During Initial Load

1. Context starts as `isAutoRefreshing: false`
2. Normal spinner behavior during hydration

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Auto-refresh fails mid-cycle | `endAutoRefresh()` still called in `finally` |
| User manually refreshes during auto-refresh | Both refreshes proceed, spinner suppressed |
| Tab becomes hidden during auto-refresh | Let current refresh complete, suppress spinner |
| Context not available (Explore page) | `useIsAutoRefreshing()` returns `false`, spinner shows |

## Alternative Approaches Considered

### Approach A: Modify chartReducer (Rejected)

Add `isAutoRefreshLoading` flag to each chart's state.

**Pros:**
- Per-chart control
- Follows existing Redux patterns

**Cons:**
- Requires modifying many files (actions, reducers, types)
- More complex state management
- Charts need to be aware of auto-refresh concept

### Approach B: CSS-based hiding (Rejected)

Use CSS classes to hide spinners during auto-refresh.

**Pros:**
- Simple implementation

**Cons:**
- Spinner component still mounts/renders (performance)
- Doesn't prevent the visual "jump" when component switches
- Less React-idiomatic

### Approach C: Context (Chosen)

Dashboard-level context that charts check.

**Pros:**
- Clean separation of concerns
- Dashboard controls the auto-refresh behavior
- Charts just check a boolean
- Easy to extend for other use cases

**Cons:**
- Requires provider wrapping
- Class components need prop drilling

## Dependencies

### Depends On
- **Task 1**: State management (for status tracking, though independent of spinner suppression)
- React Context API (built-in)

### Used By
- **Task 8**: Animation reduction (could reuse the same context)

## Performance Considerations

- Context updates are cheap (boolean toggle)
- Charts avoid unnecessary spinner mount/unmount cycles
- No additional re-renders beyond normal data updates
- Provider at dashboard level (not per-chart) minimizes context consumers
