# Task 7: Suppress Auto-Refresh Toast Notifications

## Overview

During auto-refresh cycles, a warning toast notification appears every time the refresh triggers, displaying "This dashboard is currently auto refreshing; the next auto refresh will be in X seconds." At 5-second intervals, this creates a constant stream of toast notifications that is extremely disruptive to the user experience.

Since Task 2 implements a visual status indicator in the dashboard header, these toasts become redundant. The status indicator provides continuous, non-intrusive feedback about the auto-refresh state.

## Current Implementation

### Toast Generation During Auto-Refresh

**File:** `superset-frontend/src/dashboard/components/Header/index.jsx` (lines 289-313)

```javascript
const periodicRender = () => {
  const { metadata } = dashboardInfo;
  const immune = metadata.timed_refresh_immune_slices || [];
  const affectedCharts = chartIds.filter(
    chartId => immune.indexOf(chartId) === -1,
  );

  boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
    interval,
    chartCount: affectedCharts.length,
  });
  boundActionCreators.addWarningToast(   // ← PROBLEM: This shows every refresh
    t(
      `This dashboard is currently auto refreshing; the next auto refresh will be in %s.`,
      intervalMessage,
    ),
  );
  if (
    dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
  ) {
    // force-refresh while auto-refresh in dashboard
    return fetchCharts(affectedCharts);
  }
  return fetchCharts(affectedCharts, true);
};
```

### Toast Action Types

**File:** `superset-frontend/src/components/MessageToasts/actions.ts`

```typescript
export function addWarningToast(text: string, options?: ToastOptions) {
  return addToast({
    text,
    toastType: ToastType.Warning,
    duration: 6000,  // Shows for 6 seconds
    ...options,
  });
}
```

### Problem Illustration

With a 5-second auto-refresh interval:
```
0s  → Toast appears: "...next refresh in 5 seconds"
5s  → Toast appears: "...next refresh in 5 seconds" (previous one might still be visible!)
10s → Toast appears: "...next refresh in 5 seconds"
... continuous toasts
```

## Implementation Plan

### Approach: Remove Auto-Refresh Toast

The simplest and cleanest solution is to remove the toast notification from the auto-refresh code entirely. The status indicator (Task 2) provides a better UX for continuous feedback.

### Step 1: Remove the Toast Call

**File to modify:** `superset-frontend/src/dashboard/components/Header/index.jsx`

Remove lines 300-305:

**Before:**
```javascript
const periodicRender = () => {
  const { metadata } = dashboardInfo;
  const immune = metadata.timed_refresh_immune_slices || [];
  const affectedCharts = chartIds.filter(
    chartId => immune.indexOf(chartId) === -1,
  );

  boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
    interval,
    chartCount: affectedCharts.length,
  });
  boundActionCreators.addWarningToast(
    t(
      `This dashboard is currently auto refreshing; the next auto refresh will be in %s.`,
      intervalMessage,
    ),
  );
  if (
    dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
  ) {
    return fetchCharts(affectedCharts);
  }
  return fetchCharts(affectedCharts, true);
};
```

**After:**
```javascript
const periodicRender = () => {
  const { metadata } = dashboardInfo;
  const immune = metadata.timed_refresh_immune_slices || [];
  const affectedCharts = chartIds.filter(
    chartId => immune.indexOf(chartId) === -1,
  );

  boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
    interval,
    chartCount: affectedCharts.length,
  });
  // Toast notification removed - status indicator (Task 2) provides visual feedback
  if (
    dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
  ) {
    return fetchCharts(affectedCharts);
  }
  return fetchCharts(affectedCharts, true);
};
```

### Step 2: Clean Up Unused Code (Optional)

Since `intervalMessage` is only used for the toast, we can simplify the `startPeriodicRender` function:

**Before:**
```javascript
const startPeriodicRender = useCallback(
  interval => {
    let intervalMessage;

    if (interval) {
      const periodicRefreshOptions =
        dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;
      const predefinedValue = periodicRefreshOptions.find(
        option => Number(option[0]) === interval / 1000,
      );

      if (predefinedValue) {
        intervalMessage = t(predefinedValue[1]);
      } else {
        intervalMessage = extendedDayjs
          .duration(interval, 'millisecond')
          .humanize();
      }
    }

    // ... rest of function
  },
  [boundActionCreators, chartIds, dashboardInfo],
);
```

**After:**
```javascript
const startPeriodicRender = useCallback(
  interval => {
    // intervalMessage calculation removed - no longer needed without toast

    const fetchCharts = (charts, force = false) =>
      boundActionCreators.fetchCharts(
        charts,
        force,
        interval * 0.2,
        dashboardInfo.id,
      );

    const periodicRender = () => {
      const { metadata } = dashboardInfo;
      const immune = metadata.timed_refresh_immune_slices || [];
      const affectedCharts = chartIds.filter(
        chartId => immune.indexOf(chartId) === -1,
      );

      boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
        interval,
        chartCount: affectedCharts.length,
      });

      if (
        dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
      ) {
        return fetchCharts(affectedCharts);
      }
      return fetchCharts(affectedCharts, true);
    };

    refreshTimer.current = setPeriodicRunner({
      interval,
      periodicRender,
      refreshTimer: refreshTimer.current,
    });
  },
  [boundActionCreators, chartIds, dashboardInfo],
);
```

### Step 3: Keep Manual Refresh Toast

The toast for manual refresh ("Refreshing charts") should remain. It's in a separate location:

**File:** `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx` (line 85)

```javascript
case MenuKeys.RefreshDashboard:
  forceRefreshAllCharts();
  addSuccessToast(t('Refreshing charts'));  // ← Keep this
  break;
```

This is appropriate because:
1. User explicitly requested a refresh
2. It's a one-time action, not continuous
3. It provides confirmation of user action

### Step 4: Update Tests

**File to modify:** `superset-frontend/src/dashboard/components/Header/Header.test.tsx`

Remove or update any tests that check for the auto-refresh toast:

```typescript
// If there's a test like this, remove it:
test('displays toast during auto-refresh', () => {
  // This test should be removed since toasts are no longer shown
});

// Add a test to verify toast is NOT shown:
test('does not display toast during auto-refresh', () => {
  const mockAddWarningToast = jest.fn();
  // ... setup with auto-refresh enabled

  // Trigger auto-refresh
  jest.advanceTimersByTime(refreshInterval);

  // Verify no toast was called
  expect(mockAddWarningToast).not.toHaveBeenCalled();
});
```

## File Summary

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Remove `addWarningToast` call from `periodicRender`, optionally remove `intervalMessage` calculation |
| `superset-frontend/src/dashboard/components/Header/Header.test.tsx` | Update tests related to auto-refresh toasts |

### Files NOT to Modify

| File | Reason |
|------|--------|
| `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx` | Manual refresh toast should remain |
| `superset-frontend/src/components/MessageToasts/actions.ts` | Toast action infrastructure unchanged |

## Behavior Specification

### After Implementation

| Scenario | Toast Shown? | Visual Feedback |
|----------|--------------|-----------------|
| Auto-refresh triggers | No | Status indicator (Task 2) |
| Manual "Refresh dashboard" clicked | Yes ("Refreshing charts") | Success toast + status indicator |
| Auto-refresh fails | Depends on implementation | Error state in status indicator |

### User Experience Improvement

**Before:**
- Toast every 5 seconds during auto-refresh
- Toasts stack up if refresh interval < toast duration (6s)
- Distracting and noisy

**After:**
- No toasts during auto-refresh
- Status indicator shows refresh state continuously
- Clean, non-intrusive experience
- Manual refresh still shows confirmation toast

## Dependencies

### Depends On

- **Task 2**: Status indicator must be implemented to provide visual feedback in place of toasts

### Used By

- No other tasks depend on this directly

## Alternative Approaches Considered

### Approach A: Reduce Toast Frequency (Rejected)

Only show toast every N refreshes or with a minimum interval.

**Pros:**
- Less intrusive than current behavior

**Cons:**
- Still shows some toasts, just fewer
- Inconsistent feedback timing
- Complexity in managing intervals

### Approach B: Replace with Non-Intrusive Notification (Rejected)

Use a different notification type like a badge or inline message.

**Pros:**
- Provides feedback without blocking

**Cons:**
- Status indicator (Task 2) already does this better
- Redundant implementation

### Approach C: Remove Toast Entirely (Chosen)

Remove the toast and rely on the status indicator.

**Pros:**
- Cleanest solution
- Status indicator provides better UX
- No redundant notifications
- Simpler code

**Cons:**
- Requires Task 2 to be implemented first
- Users who relied on toast won't see it (but status indicator is better)

## Additional Considerations

### Logging Preserved

The `logEvent` call for `LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD` should remain. This is for analytics/telemetry and doesn't affect UX:

```javascript
boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
  interval,
  chartCount: affectedCharts.length,
});
```

### Error Toasts

If auto-refresh encounters an error (e.g., network failure), error toasts should still be shown. These are important for user awareness of issues. This is handled separately in the chart fetching logic (Task 1's error handling).

### Backward Compatibility

Some users may have relied on the toast to confirm auto-refresh is active. The status indicator provides this information in a better way. No configuration option is needed to preserve old behavior since the new UX is strictly better.
