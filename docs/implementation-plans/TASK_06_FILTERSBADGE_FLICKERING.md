# Task 6: Fix FiltersBadge Flickering During Auto-Refresh

## Overview

During auto-refresh cycles, the FiltersBadge component shows the number of applied filters on each chart. When charts go into 'loading' state, the indicators are cleared, causing the badge to disappear momentarily and then reappear when the chart finishes loading. This creates a flickering effect that is visually distracting during frequent auto-refresh cycles.

## Current Implementation

### FiltersBadge Component

**File:** `superset-frontend/src/dashboard/components/FiltersBadge/index.tsx`

The FiltersBadge displays the count of applied filters on a chart. Key code sections:

**Lines 152-154 - showIndicators condition:**
```typescript
const showIndicators =
  chart?.chartStatus && ['rendered', 'success'].includes(chart.chartStatus);
```

**Lines 163-184 - Dashboard indicators clearing:**
```typescript
useEffect(() => {
  if (!showIndicators && dashboardIndicators.length > 0) {
    setDashboardIndicators(indicatorsInitialState);  // ← Clears indicators
  } else if (prevChartStatus !== 'success') {
    if (
      chart?.queriesResponse?.[0]?.rejected_filters !==
        prevChart?.queriesResponse?.[0]?.rejected_filters ||
      chart?.queriesResponse?.[0]?.applied_filters !==
        prevChart?.queriesResponse?.[0]?.applied_filters ||
      dashboardFilters !== prevDashboardFilters ||
      datasources !== prevDatasources
    ) {
      setDashboardIndicators(
        selectIndicatorsForChart(
          chartId,
          dashboardFilters,
          datasources,
          chart,
        ),
      );
    }
  }
}, [...]);
```

**Lines 203-228 - Native indicators clearing:**
```typescript
useEffect(() => {
  if (!showIndicators && nativeIndicators.length > 0) {
    setNativeIndicators(indicatorsInitialState);  // ← Clears indicators
  } else if (prevChartStatus !== 'success') {
    // ... recalculate indicators
  }
}, [...]);
```

**Lines 276-278 - Badge returns null when no indicators:**
```typescript
if (!appliedCrossFilterIndicators.length && !appliedIndicators.length) {
  return null;  // ← Badge disappears
}
```

### The Flickering Flow

```
Auto-refresh triggered
       ↓
Chart status: 'loading'
       ↓
showIndicators = false
       ↓
setDashboardIndicators([])
setNativeIndicators([])
       ↓
appliedIndicators.length = 0
       ↓
FiltersBadge returns null (DISAPPEARS)
       ↓
Chart data arrives
       ↓
Chart status: 'success' → 'rendered'
       ↓
showIndicators = true
       ↓
Indicators recalculated
       ↓
FiltersBadge re-renders (APPEARS)
```

### Where FiltersBadge is Rendered

**File:** `superset-frontend/src/dashboard/components/SliceHeader/index.tsx` (line 301)

```typescript
{!uiConfig.hideChartControls && (
  <FiltersBadge chartId={slice.slice_id} />
)}
```

## Implementation Plan

### Approach: Use AutoRefreshContext

The fix leverages the AutoRefreshContext created in Task 5. During auto-refresh, we preserve the existing indicators instead of clearing them.

### Step 1: Import the Context Hook

**File to modify:** `superset-frontend/src/dashboard/components/FiltersBadge/index.tsx`

Add the import:

```typescript
import { useIsAutoRefreshing } from 'src/dashboard/contexts/AutoRefreshContext';
```

### Step 2: Use the Hook in the Component

Inside the `FiltersBadge` component, get the auto-refresh state:

```typescript
export const FiltersBadge = ({ chartId }: FiltersBadgeProps) => {
  const dispatch = useDispatch();
  const isAutoRefreshing = useIsAutoRefreshing();  // NEW

  // ... rest of the component
```

### Step 3: Modify Dashboard Indicators Effect

Update the first useEffect to preserve indicators during auto-refresh:

```typescript
useEffect(() => {
  // During auto-refresh, don't clear indicators - preserve previous state
  if (!showIndicators && dashboardIndicators.length > 0 && !isAutoRefreshing) {
    setDashboardIndicators(indicatorsInitialState);
  } else if (prevChartStatus !== 'success') {
    if (
      chart?.queriesResponse?.[0]?.rejected_filters !==
        prevChart?.queriesResponse?.[0]?.rejected_filters ||
      chart?.queriesResponse?.[0]?.applied_filters !==
        prevChart?.queriesResponse?.[0]?.applied_filters ||
      dashboardFilters !== prevDashboardFilters ||
      datasources !== prevDatasources
    ) {
      setDashboardIndicators(
        selectIndicatorsForChart(
          chartId,
          dashboardFilters,
          datasources,
          chart,
        ),
      );
    }
  }
}, [
  chart,
  chartId,
  dashboardFilters,
  dashboardIndicators.length,
  datasources,
  prevChart?.queriesResponse,
  prevChartStatus,
  prevDashboardFilters,
  prevDatasources,
  showIndicators,
  isAutoRefreshing,  // NEW dependency
]);
```

### Step 4: Modify Native Indicators Effect

Update the second useEffect similarly:

```typescript
useEffect(() => {
  // During auto-refresh, don't clear indicators - preserve previous state
  if (!showIndicators && nativeIndicators.length > 0 && !isAutoRefreshing) {
    setNativeIndicators(indicatorsInitialState);
  } else if (prevChartStatus !== 'success') {
    if (
      chart?.queriesResponse?.[0]?.rejected_filters !==
        prevChart?.queriesResponse?.[0]?.rejected_filters ||
      chart?.queriesResponse?.[0]?.applied_filters !==
        prevChart?.queriesResponse?.[0]?.applied_filters ||
      nativeFilters !== prevNativeFilters ||
      chartLayoutItems !== prevChartLayoutItems ||
      dataMask !== prevDataMask ||
      prevChartConfig !== chartConfiguration
    ) {
      setNativeIndicators(
        selectNativeIndicatorsForChart(
          nativeFilters,
          dataMask,
          chartId,
          chart,
          chartLayoutItems,
          chartConfiguration,
        ),
      );
    }
  }
}, [
  chart,
  chartId,
  chartConfiguration,
  dataMask,
  nativeFilters,
  nativeIndicators.length,
  prevChart?.queriesResponse,
  prevChartConfig,
  prevChartStatus,
  prevDataMask,
  prevNativeFilters,
  showIndicators,
  chartLayoutItems,
  prevChartLayoutItems,
  isAutoRefreshing,  // NEW dependency
]);
```

### Step 5: Update Unit Tests

**File to modify:** `superset-frontend/src/dashboard/components/FiltersBadge/FiltersBadge.test.tsx`

Add test cases for auto-refresh behavior:

```typescript
import { AutoRefreshProvider } from 'src/dashboard/contexts/AutoRefreshContext';

// Mock the context
const mockAutoRefreshContext = {
  isAutoRefreshing: false,
  setIsAutoRefreshing: jest.fn(),
  startAutoRefresh: jest.fn(),
  endAutoRefresh: jest.fn(),
};

jest.mock('src/dashboard/contexts/AutoRefreshContext', () => ({
  ...jest.requireActual('src/dashboard/contexts/AutoRefreshContext'),
  useIsAutoRefreshing: () => mockAutoRefreshContext.isAutoRefreshing,
}));

// Add to the test file:

test('preserves indicator count during auto-refresh loading state', () => {
  const store = getMockStoreWithNativeFilters();

  // First, set up a chart with applied filters in rendered state
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });

  // Now simulate auto-refresh by setting the context
  mockAutoRefreshContext.isAutoRefreshing = true;

  // Dispatch loading state
  store.dispatch({
    type: CHART_UPDATE_STARTED,
    key: sliceId,
  });

  const { getByTestId } = setup(store);

  // Badge should still be visible during auto-refresh loading
  expect(getByTestId('applied-filter-count')).toHaveTextContent('1');

  // Reset mock
  mockAutoRefreshContext.isAutoRefreshing = false;
});

test('clears indicators during manual refresh loading state', () => {
  const store = getMockStoreWithNativeFilters();

  // First, set up a chart with applied filters in rendered state
  store.dispatch({
    type: CHART_UPDATE_SUCCEEDED,
    key: sliceId,
    queriesResponse: [
      {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
    ],
  });
  store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });

  // Keep auto-refresh as false (manual refresh)
  mockAutoRefreshContext.isAutoRefreshing = false;

  // Dispatch loading state
  store.dispatch({
    type: CHART_UPDATE_STARTED,
    key: sliceId,
  });

  const { queryByTestId } = setup(store);

  // Badge should disappear during manual refresh loading
  expect(queryByTestId('applied-filter-count')).not.toBeInTheDocument();
});
```

## File Summary

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/FiltersBadge/index.tsx` | Import `useIsAutoRefreshing`, use it to conditionally preserve indicators |
| `superset-frontend/src/dashboard/components/FiltersBadge/FiltersBadge.test.tsx` | Add tests for auto-refresh behavior |

### No New Files Required

This task only modifies existing files and leverages the `AutoRefreshContext` created in Task 5.

## Behavior Specification

### During Auto-Refresh

1. Chart enters 'loading' state
2. `isAutoRefreshing` is `true` (set by Header in Task 3)
3. Condition `!showIndicators && !isAutoRefreshing` is `false`
4. Indicators are NOT cleared
5. Badge remains visible with previous count
6. When chart finishes loading, indicators are recalculated
7. Badge updates seamlessly without disappearing

### During Manual Refresh

1. Chart enters 'loading' state
2. `isAutoRefreshing` is `false`
3. Condition `!showIndicators && !isAutoRefreshing` is `true`
4. Indicators ARE cleared (normal behavior preserved)
5. Badge disappears (expected for user-initiated actions)

### During Initial Load

1. Indicators start empty
2. Context starts as `isAutoRefreshing: false`
3. Normal loading/indicator behavior

### Outside Dashboard Context (Explore Page)

1. `useIsAutoRefreshing()` returns `false` (default)
2. Normal clearing behavior preserved
3. No flickering issue exists on Explore page (single chart)

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Auto-refresh fails mid-cycle | Indicators preserved until `endAutoRefresh()` called in `finally` block |
| Filters changed during auto-refresh | Indicators will update when queriesResponse changes |
| Tab visibility changes | If paused (Task 4), no refresh occurs, indicators stable |
| Context not available | Default `false`, normal behavior preserved |

## Dependencies

### Depends On

- **Task 5**: AutoRefreshContext must be created and providing `useIsAutoRefreshing`
- **Task 1**: Dashboard state management for auto-refresh tracking

### Used By

- No other tasks depend on this task directly

## Performance Considerations

- Single context check per render (cheap boolean comparison)
- No additional selectors or expensive computations
- Reduces unnecessary state updates during auto-refresh (actually improves performance)
- Fewer DOM operations since badge doesn't unmount/remount

## Alternative Approaches Considered

### Approach A: Debounce Indicator Clearing (Rejected)

Add a delay before clearing indicators.

**Pros:**
- Simple implementation

**Cons:**
- Doesn't solve the problem, just masks it
- Creates unpredictable timing issues
- Would need to tune debounce interval vs refresh interval

### Approach B: CSS Opacity Transition (Rejected)

Use CSS to fade out/in instead of unmounting.

**Pros:**
- Visual smoothing

**Cons:**
- Component still goes through unmount/mount cycles
- React state still changes unnecessarily
- Not a real fix, just a visual band-aid

### Approach C: Use AutoRefreshContext (Chosen)

Check the dashboard-level auto-refresh flag.

**Pros:**
- Clean and intentional solution
- Reuses existing context from Task 5
- Minimal code changes
- Preserves normal behavior for manual refresh
- Actually prevents unnecessary state changes

**Cons:**
- Depends on Task 5 being implemented first (acceptable dependency)
