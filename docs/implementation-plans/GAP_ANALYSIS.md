# Gap Analysis: Real-Time Dashboard Requirements vs Implementation Plans

## Summary

This document identifies gaps between the original requirements and the implementation plans (Tasks 1-10).

---

## Critical Gaps (RESOLVED)

### 1. ✅ Status Indicator Color Mismatch - Paused State

**Requirement:**
> White dot - "Paused" - "Auto-refresh paused"

**Resolution:** Fixed in Task 2. Updated `getStatusConfig` to return `#FFFFFF` for paused state with `needsBorder: true` for visibility on light backgrounds.

---

### 2. ✅ Green Dot with Checkmark Icon

**Requirement:**
> Green dot (with checkmark) - "Refreshed on schedule"

**Resolution:** Fixed in Task 2. Added `showCheckmark: true` for success state and `CheckOutlined` icon component inside the `StatusIndicatorDot`.

---

### 3. ✅ "Delayed" State Definition and Detection

**Requirement:**
> Yellow / warning dot - "Delayed" - Timestamp + delay description

**Resolution:** Fixed in Task 1. Added `autoRefreshFetchStartTime` to state interface and enhanced `selectEffectiveRefreshStatus` with time-based delay detection (threshold: 50% of refresh interval).

**Thresholds (implemented):**
- **Delayed (Yellow)**: Fetch takes > 50% of the interval (e.g., > 2.5s for 5s interval)
- **Error (Red)**: After explicit error OR after missing 2+ consecutive refreshes

---

### 4. ✅ Refresh Icon Behavior Not Explicitly Covered

**Requirement:**
> Refresh icon - Triggers an immediate hard refresh - Retains existing auto-refresh interval settings

**Resolution:** Fixed in Task 3. Added "Manual Refresh Icon Behavior" section with explicit code for updating status indicator during manual refresh and preserving auto-refresh settings.

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

| Priority | Gap | Task to Update | Status |
|----------|-----|----------------|--------|
| Critical | Paused state should be WHITE, not gray | Task 2 | ✅ Fixed |
| Critical | Green dot needs checkmark icon | Task 2 | ✅ Fixed |
| Critical | Delayed state detection logic missing | Task 1 | ✅ Fixed |
| Critical | Refresh icon integration with status | Task 3 | ✅ Fixed |
| Medium | Delay description in tooltip | Task 2 | Pending |
| Medium | Flicker prevention test cases | Task 10 | Pending |
| Medium | Tab inactive status display | Task 4 | Pending |
| Low | Auto-pause configurability | Task 4 | Pending |
| Low | Time-series ticker mode | Future | Deferred |
| Low | Non-ECharts animations | Task 8 | Pending |

---

## Recommended Next Steps

### Completed ✅

1. **Task 2 updated** with:
   - White color (`#FFFFFF`) for paused state with border for visibility
   - Checkmark icon for success state using `CheckOutlined`

2. **Task 1 updated** with:
   - Delay detection logic using `autoRefreshFetchStartTime`
   - Enhanced `selectEffectiveRefreshStatus` selector

3. **Task 3 updated** with:
   - Explicit "Manual Refresh Icon Behavior" section
   - Integration with status indicator during manual refresh

### Remaining (Medium/Low Priority)

4. **Update Task 4** with:
   - Clarification on paused state display during tab inactivity
   - Consider adding pause reason tracking (`'manual' | 'tab_inactive'`)

5. **Update Task 10** with:
   - Explicit flicker prevention tests
   - Re-mount prevention tests

---

## Second Pass Analysis (All Resolved ✅)

### Gap A: ✅ Delayed Tooltip Missing Delay Description

**Requirement:**
> Delayed | Yellow / warning dot | Timestamp + **delay description**

**Resolution:** Fixed in Task 2. Updated `getStatusMessage` to include fetch elapsed time:
```typescript
'Fetching is taking longer than expected (%ss elapsed, expected within %ss)'
```

---

### Gap B: ✅ Error Tooltip Should Show BOTH Timestamp AND Error

**Requirement:**
> Error | Red dot | Timestamp + error description

**Resolution:** Fixed in Task 2. Updated to show both timestamp and error message:
```typescript
`${timestampPart}. ${t('Error: %s', lastError)}`
```

---

### Gap C: ✅ Missing Action for `autoRefreshFetchStartTime`

**Resolution:** Fixed in Task 1. Added:
- `SET_AUTO_REFRESH_FETCH_START_TIME` action type
- `setAutoRefreshFetchStartTime(timestamp)` action creator
- Reducer handler for the action

---

### Gap D: ✅ Task 10 Test Expects Yellow for Paused

**Resolution:** Fixed in Task 10. Updated test to expect white color with border:
```typescript
test('displays white dot with border when paused', () => {
  expect(dot).toHaveStyle({ backgroundColor: '#FFFFFF' });
  expect(dot).toHaveStyle({ border: expect.stringContaining('1px solid') });
});
```

---

### Gap E: ✅ Pause Button Header Placement

**Resolution:** Fixed in Task 3. Changed "(optional alternative to menu item)" to "(REQUIRED per requirements)" with explanation that the pause icon is mandatory.

---

### Gap F: ✅ Test for Non-Real-Time Dashboard

**Resolution:** Fixed in Task 10. Added E2E test verifying no status indicator or controls appear when auto-refresh is disabled.

---

## Final Action Items Summary

| Priority | Gap | Task | Status |
|----------|-----|------|--------|
| Critical | Paused state should be WHITE, not gray | Task 2 | ✅ Fixed |
| Critical | Green dot needs checkmark icon | Task 2 | ✅ Fixed |
| Critical | Delayed state detection logic missing | Task 1 | ✅ Fixed |
| Critical | Refresh icon integration with status | Task 3 | ✅ Fixed |
| Medium | Delayed tooltip needs delay description | Task 2 | ✅ Fixed (Second Pass) |
| Medium | Error tooltip needs timestamp + error | Task 2 | ✅ Fixed (Second Pass) |
| Medium | Missing SET_AUTO_REFRESH_FETCH_START_TIME | Task 1 | ✅ Fixed (Second Pass) |
| Medium | Flicker prevention test cases | Task 10 | Pending (Documented) |
| Medium | Tab inactive status display | Task 4 | Pending (Open Question #4) |
| Low | Task 10 test expects yellow for paused | Task 10 | ✅ Fixed (Second Pass) |
| Low | Pause button must be in header | Task 3 | ✅ Fixed (Second Pass) |
| Low | Test for non-real-time dashboard | Task 10 | ✅ Fixed (Second Pass) |
| Low | Auto-pause configurability | Task 4 | Pending (Open Question #6) |
| Low | Time-series ticker mode | Future | Deferred (Nice-to-have) |
| Low | Non-ECharts animations | Task 8 | Documented
