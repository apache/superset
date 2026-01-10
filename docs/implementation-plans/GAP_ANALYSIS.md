# Gap Analysis: Real-Time Dashboard Requirements vs Implementation Plans

## Summary

This document identifies gaps between the original requirements and the implementation plans (Tasks 1-10).

---

## Critical Gaps

### 1. Status Indicator Color Mismatch - Paused State

**Requirement:**
> White dot - "Paused" - "Auto-refresh paused"

**Current Implementation Plan (Task 2):**
```typescript
case AutoRefreshStatus.Paused:
  return theme.colorTextSecondary;  // Gray, not white
```

**Fix Required:**
Change the paused state color to white:
```typescript
case AutoRefreshStatus.Paused:
  return '#FFFFFF';  // White with border for visibility
  // Or use: theme.colorBgContainer with a border
```

**Additional Consideration:**
A pure white dot may not be visible on light backgrounds. Implementation should include:
- A subtle border or shadow for visibility
- Or use a hollow/outline style for the paused state

---

### 2. Green Dot with Checkmark Icon

**Requirement:**
> Green dot (with checkmark) - "Refreshed on schedule"

**Current Implementation Plan (Task 2):**
Only shows a plain green dot without a checkmark icon.

**Fix Required:**
Update `StatusIndicatorDot` to include a checkmark icon for success state:
```typescript
import { CheckOutlined } from '@ant-design/icons';

// In the component:
{status === AutoRefreshStatus.Success && (
  <CheckOutlined style={{ fontSize: size * 0.6, color: '#fff' }} />
)}
```

Or use a combined icon approach:
```typescript
import { CheckCircleFilled } from '@ant-design/icons';

// Use CheckCircleFilled for success state instead of a plain dot
```

---

### 3. "Delayed" State Definition and Detection

**Requirement:**
> Yellow / warning dot - "Delayed" - Timestamp + delay description

**Open Question from Requirements:**
> #5: Error state thresholds: confirm logic for delayed vs error (e.g., yellow after 1 missed refresh, red after 2+)

**Current Implementation Plan (Task 1):**
Defines `AutoRefreshStatus.Delayed` but does not specify:
- When exactly a refresh becomes "delayed"
- How to detect/calculate delay
- Threshold timing

**Fix Required:**
Add delay detection logic to Task 1:

```typescript
// In dashboardState.ts
interface DashboardState {
  // ... existing fields
  autoRefreshExpectedTime: number | null;  // When next refresh should occur
}

// In the reducer or selector:
const isDelayed = (state: DashboardState): boolean => {
  if (!state.autoRefreshExpectedTime) return false;
  const now = Date.now();
  const threshold = state.refreshFrequency * 1000 * 0.5; // 50% over expected
  return now > state.autoRefreshExpectedTime + threshold;
};

// Status determination logic:
const getEffectiveStatus = (state: DashboardState): AutoRefreshStatus => {
  if (state.autoRefreshIsPaused) return AutoRefreshStatus.Paused;
  if (state.autoRefreshError) return AutoRefreshStatus.Error;
  if (state.autoRefreshStatus === AutoRefreshStatus.Fetching) {
    // Check if fetching is taking too long
    const fetchDuration = Date.now() - state.autoRefreshFetchStartTime;
    if (fetchDuration > state.refreshFrequency * 1000 * 0.5) {
      return AutoRefreshStatus.Delayed;
    }
    return AutoRefreshStatus.Fetching;
  }
  return AutoRefreshStatus.Idle;
};
```

**Suggested Thresholds (pending design confirmation):**
- **Delayed (Yellow)**: Refresh takes > 50% of the interval (e.g., > 2.5s for 5s interval)
- **Error (Red)**: After explicit error OR after missing 2+ consecutive refreshes

---

### 4. Refresh Icon Behavior Not Explicitly Covered

**Requirement:**
> Refresh icon - Triggers an immediate hard refresh - Retains existing auto-refresh interval settings

**Current Implementation Plans:**
The existing refresh icon functionality is assumed to work, but not explicitly verified or integrated with the new status indicator.

**Fix Required:**
Add to Task 3 (Pause/Resume) or create a sub-section:

```typescript
// Ensure forceRefresh in Header/index.jsx:
const forceRefresh = useCallback(() => {
  if (!isLoading) {
    // Update status indicator to show fetching
    setAutoRefreshStatus(AutoRefreshStatus.Fetching);

    boundActionCreators.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
      force: true,
      interval: 0,
      chartCount: chartIds.length,
    });

    return boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id)
      .finally(() => {
        // Status will update based on success/failure
        recordAutoRefreshSuccess(); // or recordAutoRefreshError()
      });
  }
  return false;
}, [/* deps */]);
```

**Verification Needed:**
- Confirm refresh icon does NOT clear/reset the auto-refresh interval
- Confirm status indicator updates during manual refresh

---

### 5. Tooltip Content Completeness

**Requirement:**
| State | Tooltip |
|-------|---------|
| Refreshed on schedule | Timestamp of last refresh |
| Fetching data | "Fetching data…" |
| Delayed | Timestamp + delay description |
| Error | Timestamp + error description |
| Paused | "Auto-refresh paused" |

**Current Implementation Plan (Task 2):**
Covers most tooltip content but needs verification for:
- Delay description format (e.g., "Last refresh was 8 seconds ago, expected every 5 seconds")
- Error description includes actual error message

**Fix Required:**
Enhance `StatusTooltipContent` component:

```typescript
const getDelayDescription = (
  lastRefresh: number | null,
  refreshFrequency: number,
): string => {
  if (!lastRefresh) return t('Waiting for first refresh...');

  const elapsed = Date.now() - lastRefresh;
  const expected = refreshFrequency * 1000;
  const delay = elapsed - expected;

  return t(
    'Last refresh %s ago. Expected every %s seconds. Delayed by %s.',
    formatDuration(elapsed),
    refreshFrequency,
    formatDuration(delay),
  );
};
```

---

## Medium Priority Gaps

### 6. Flicker Prevention - Explicit Testing

**Requirement (from comments):**
> "call out to make sure the status indicator color doesn't blink (if it's green between refreshes, it shouldn't blink green, for example)"

**Current Implementation Plan:**
Task 2 includes debouncing and CSS transitions, but:
- No explicit test cases for flicker prevention
- No mention of preventing re-mount flickering

**Fix Required:**
Add to Task 10 (Testing):

```typescript
test('status indicator does not flicker during refresh cycle', async () => {
  jest.useFakeTimers();

  const { getByTestId } = render(<AutoRefreshStatus />);
  const dot = getByTestId('auto-refresh-status-dot');

  // Record all style changes
  const styleChanges: string[] = [];
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        styleChanges.push((mutation.target as HTMLElement).style.backgroundColor);
      }
    });
  });
  observer.observe(dot, { attributes: true });

  // Trigger multiple refresh cycles
  for (let i = 0; i < 5; i++) {
    act(() => jest.advanceTimersByTime(5000));
    await waitFor(() => {});
  }

  // Verify no rapid color changes (should be smooth transitions only)
  // Green should not flash to green
  const greenToGreen = styleChanges.filter(
    (color, i) => i > 0 && color === 'green' && styleChanges[i-1] === 'green'
  );
  expect(greenToGreen.length).toBe(0);

  observer.disconnect();
  jest.useRealTimers();
});
```

---

### 7. Tab Visibility - Status Indicator Display

**Open Question from Requirements:**
> #4: When the tab is inactive and auto-refresh is paused, should the status indicator always show the paused (white) state?

**Current Implementation Plan (Task 4):**
Assumes yes, but this is not confirmed.

**Clarification Needed:**
The implementation plan should explicitly handle:
- When tab becomes hidden → Status shows Paused (White)
- The tooltip should indicate "Paused (tab inactive)" vs "Paused (manual)"

**Suggested Enhancement:**
```typescript
// In state management:
interface DashboardState {
  autoRefreshIsPaused: boolean;
  autoRefreshPauseReason: 'manual' | 'tab_inactive' | null;
}

// In tooltip:
const getPausedTooltip = (reason: string | null): string => {
  if (reason === 'tab_inactive') {
    return t('Auto-refresh paused (tab inactive)');
  }
  return t('Auto-refresh paused');
};
```

---

### 8. Auto-Pause Configurability

**Open Question from Requirements:**
> #6: Should "auto-pause on inactive tab" be user-configurable in the auto-refresh UI, or always on?

**Current Implementation Plan (Task 4):**
Implements auto-pause as always-on behavior.

**Consideration:**
If this should be configurable, add to Task 4:
- Add checkbox in RefreshIntervalModal: "Pause when tab is inactive"
- Store preference in dashboard state or local storage
- Default to enabled

---

### 9. Session vs Persistent Refresh Settings

**Open Question from Requirements:**
> #7: Should manual refresh behavior persist auto-refresh settings beyond the current session?

**Current Implementation Plan:**
Task 9 covers the 5-second option but doesn't address persistence behavior.

**Current Behavior Analysis:**
- `shouldPersistRefreshFrequency` exists in state
- RefreshIntervalModal has "Save" vs "Save for this session" options

**Clarification Needed:**
Verify the existing persistence behavior works correctly with the new features.

---

## Low Priority Gaps

### 10. Future Consideration: Time-Series Ticker Behavior

**Requirement:**
> For time-series charts (line, area, bar), explore appending new data points to the right side of the chart (ticker-style) rather than re-rendering the entire visualization.

**Current Implementation Plans:**
Not addressed (marked as "Nice-to-have" in requirements).

**Recommendation:**
Add a separate future enhancement document or note in Task 10:

```markdown
## Future Enhancement: Time-Series Ticker Mode

For time-series visualizations, consider implementing a "ticker mode" that:
1. Appends new data points to the right side
2. Scrolls/pans the chart rather than re-rendering
3. Maintains smooth animation for incoming data

This requires investigation into:
- ECharts `appendData` API
- Data point diffing algorithm
- Chart configuration for streaming mode
```

---

### 11. Non-ECharts Chart Animations

**Current Implementation Plan (Task 8):**
Focuses only on ECharts-based charts.

**Gap:**
Other chart types (Table, Word Cloud, etc.) may have their own animations not covered.

**Recommendation:**
Add note to Task 8:
- Table charts: No animations typically
- Word Cloud: May need separate investigation
- Deck.gl charts: May need separate investigation

---

## Action Items Summary

| Priority | Gap | Task to Update |
|----------|-----|----------------|
| Critical | Paused state should be WHITE, not gray | Task 2 |
| Critical | Green dot needs checkmark icon | Task 2 |
| Critical | Delayed state detection logic missing | Task 1, Task 2 |
| Critical | Refresh icon integration with status | Task 3 |
| Medium | Delay description in tooltip | Task 2 |
| Medium | Flicker prevention test cases | Task 10 |
| Medium | Tab inactive status display | Task 4 |
| Low | Auto-pause configurability | Task 4 |
| Low | Time-series ticker mode | Future |
| Low | Non-ECharts animations | Task 8 |

---

## Recommended Next Steps

1. **Update Task 2** with:
   - White color for paused state (with border for visibility)
   - Checkmark icon for success state
   - Enhanced tooltip content for delayed state

2. **Update Task 1** with:
   - Delay detection logic
   - `autoRefreshExpectedTime` tracking
   - `autoRefreshFetchStartTime` for measuring fetch duration

3. **Update Task 3** with:
   - Explicit refresh icon behavior
   - Integration with status indicator during manual refresh

4. **Update Task 4** with:
   - Clarification on paused state display during tab inactivity
   - Consider adding pause reason tracking

5. **Update Task 10** with:
   - Explicit flicker prevention tests
   - Re-mount prevention tests
