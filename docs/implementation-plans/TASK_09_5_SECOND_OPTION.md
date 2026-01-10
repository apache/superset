# Task 9: Add 5-Second Refresh Interval Option

## Overview

Add a 5-second auto-refresh interval option to enable near real-time dashboard experiences. This requires modifying both the backend configuration and frontend UI components, while considering the server load implications.

## Current Implementation

### Backend Configuration

**File:** `superset/config.py` (lines 1185-1196)

```python
# Dashboard auto refresh intervals
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [0, "Don't refresh"],
    [10, "10 seconds"],
    [30, "30 seconds"],
    [60, "1 minute"],
    [300, "5 minutes"],
    [1800, "30 minutes"],
    [3600, "1 hour"],
    [21600, "6 hours"],
    [43200, "12 hours"],
    [86400, "24 hours"],
]
```

### Frontend Refresh Frequency Options

**File:** `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.tsx` (lines 24-65)

```typescript
// Minimum safe refresh interval to prevent server overload
export const MINIMUM_REFRESH_INTERVAL = 10;

// Standard refresh frequency options used across modals
export const REFRESH_FREQUENCY_OPTIONS = [
  { value: 0, label: t("Don't refresh") },
  { value: 10, label: t('10 seconds') },
  { value: 30, label: t('30 seconds') },
  { value: 60, label: t('1 minute') },
  // ... more options
  { value: -1, label: t('Custom') },
];
```

### RefreshIntervalModal

**File:** `superset-frontend/src/dashboard/components/RefreshIntervalModal.tsx`

Uses `RefreshFrequencySelect` component to display options.

### Feature Flag Consideration

The backend also has a setting for auto-refresh mode:

```python
DASHBOARD_AUTO_REFRESH_MODE: Literal["fetch", "force"] = "force"
```

This controls whether auto-refresh uses cached data or forces a fresh query.

## Implementation Plan

### Step 1: Update Backend Configuration

**File to modify:** `superset/config.py`

Add the 5-second option:

```python
# Dashboard auto refresh intervals
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [0, "Don't refresh"],
    [5, "5 seconds"],      # NEW: Added for real-time dashboards
    [10, "10 seconds"],
    [30, "30 seconds"],
    [60, "1 minute"],
    [300, "5 minutes"],
    [1800, "30 minutes"],
    [3600, "1 hour"],
    [21600, "6 hours"],
    [43200, "12 hours"],
    [86400, "24 hours"],
]
```

### Step 2: Update Frontend Options

**File to modify:** `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.tsx`

Update the minimum interval and add 5-second option:

```typescript
// Minimum safe refresh interval to prevent server overload
// Reduced to 5 seconds to support real-time dashboard use cases
// Note: Administrators should monitor server load when this is enabled
export const MINIMUM_REFRESH_INTERVAL = 5;

// Standard refresh frequency options used across modals
export const REFRESH_FREQUENCY_OPTIONS = [
  { value: 0, label: t("Don't refresh") },
  { value: 5, label: t('5 seconds') },     // NEW
  { value: 10, label: t('10 seconds') },
  { value: 30, label: t('30 seconds') },
  { value: 60, label: t('1 minute') },
  { value: 300, label: t('5 minutes') },
  { value: 1800, label: t('30 minutes') },
  { value: 3600, label: t('1 hour') },
  { value: 21600, label: t('6 hours') },
  { value: 43200, label: t('12 hours') },
  { value: 86400, label: t('24 hours') },
  { value: -1, label: t('Custom') },
];
```

### Step 3: Add Warning for Low Refresh Intervals

**File to modify:** `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.tsx`

Update the warning message function:

```typescript
/**
 * Generates warning message for low refresh frequencies
 */
export const getRefreshWarningMessage = (
  frequency: number,
  refreshLimit?: number,
  refreshWarning?: string,
): string | null => {
  // Warn about aggressive refresh intervals that may impact performance
  if (frequency > 0 && frequency <= 10) {
    return t(
      'Refresh intervals of %s seconds or less may impact server performance and increase load. ' +
      'Consider using this only for dashboards with optimized queries and caching.',
      frequency,
    );
  }

  if (
    frequency > 0 &&
    refreshLimit &&
    frequency < refreshLimit &&
    refreshWarning
  ) {
    return refreshWarning;
  }
  return null;
};
```

### Step 4: Update Tests

**File to modify:** `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.test.tsx`

Add tests for the 5-second option:

```typescript
test('includes 5-second option in frequency list', () => {
  render(<RefreshFrequencySelect value={0} onChange={jest.fn()} />);

  // Check that 5 seconds option is present
  expect(screen.getByText('5 seconds')).toBeInTheDocument();
});

test('allows selection of 5-second interval', () => {
  const onChange = jest.fn();
  render(<RefreshFrequencySelect value={0} onChange={onChange} />);

  // Click on 5 seconds option
  const fiveSecOption = screen.getByText('5 seconds');
  fireEvent.click(fiveSecOption);

  expect(onChange).toHaveBeenCalledWith(5);
});

test('displays warning for 5-second interval', () => {
  const warning = getRefreshWarningMessage(5);
  expect(warning).toContain('impact server performance');
});

test('MINIMUM_REFRESH_INTERVAL is 5 seconds', () => {
  expect(MINIMUM_REFRESH_INTERVAL).toBe(5);
});
```

### Step 5: Documentation Update

**File to modify:** `superset/config.py`

Add comment explaining 5-second interval implications:

```python
# Dashboard auto refresh intervals
# Note: The 5-second interval is intended for real-time analytics use cases.
# Enable with caution as it significantly increases server load.
# Consider the following optimizations when using sub-10-second intervals:
# - Enable query caching for frequently accessed data
# - Use DASHBOARD_AUTO_REFRESH_MODE = "fetch" to use cache more aggressively
# - Ensure database queries are optimized with proper indexes
# - Consider using materialized views for complex aggregations
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [0, "Don't refresh"],
    [5, "5 seconds"],      # High frequency - use with optimized queries
    [10, "10 seconds"],
    [30, "30 seconds"],
    [60, "1 minute"],
    [300, "5 minutes"],
    [1800, "30 minutes"],
    [3600, "1 hour"],
    [21600, "6 hours"],
    [43200, "12 hours"],
    [86400, "24 hours"],
]
```

## File Summary

### Files to Modify

| File | Changes |
|------|---------|
| `superset/config.py` | Add `[5, "5 seconds"]` to `DASHBOARD_AUTO_REFRESH_INTERVALS`, add documentation |
| `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.tsx` | Add 5-second option, update `MINIMUM_REFRESH_INTERVAL`, enhance warning message |

### Files to Add or Modify for Tests

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.test.tsx` | Add tests for 5-second interval |

## Behavior Specification

### User Experience

1. User opens "Set auto-refresh" modal
2. 5-second option appears as the first non-zero interval
3. When selected, a warning message appears about server performance
4. User can confirm and save the selection
5. Dashboard refreshes every 5 seconds

### Custom Interval Validation

With `MINIMUM_REFRESH_INTERVAL = 5`:
- Custom values of 5 or greater are allowed
- Values below 5 are rejected with validation error
- Input field placeholder shows "5+"

### Warning Display

When 5-second or 10-second interval is selected:
```
Warning: Refresh intervals of 5 seconds or less may impact server performance
and increase load. Consider using this only for dashboards with optimized
queries and caching.
```

## Dependencies

### Depends On

- **Tasks 1-8**: All visual optimization tasks should be complete before enabling 5-second refresh
  - Without spinner suppression, animation reduction, etc., the 5-second refresh would be visually jarring

### Used By

- No other tasks depend on this directly

## Server Load Considerations

### Impact Analysis

At 5-second intervals:
- 12 refresh cycles per minute (vs 6 at 10 seconds)
- 720 refresh cycles per hour
- Each refresh triggers queries for all visible charts

### Mitigation Strategies

1. **Query Caching**: Enable result caching with appropriate TTL
2. **Auto-Refresh Mode**: Use `DASHBOARD_AUTO_REFRESH_MODE = "fetch"` to prefer cached data
3. **Lazy Loading**: Only refresh visible charts (existing behavior)
4. **Tab Visibility Pause**: Task 4 implementation prevents refresh when tab is hidden
5. **Connection Pooling**: Ensure database connection pooling is configured

### Configuration Recommendation

For deployments enabling 5-second refresh:

```python
# superset_config.py

# Prefer cached data during auto-refresh
DASHBOARD_AUTO_REFRESH_MODE = "fetch"

# Enable result caching
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 60,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': 'redis',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 1,
}

# Set shorter cache timeout for "real-time" dashboards
DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 10,  # 10 seconds
    'CACHE_KEY_PREFIX': 'superset_data_',
    'CACHE_REDIS_HOST': 'redis',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 2,
}
```

## Alternative Approaches Considered

### Approach A: Feature Flag for 5-Second Option (Rejected)

Hide 5-second option behind a feature flag.

**Pros:**
- Controlled rollout
- Easy to disable if issues arise

**Cons:**
- Adds complexity
- Users may not know about the option
- Inconsistent experience

### Approach B: Admin-Only Setting (Rejected)

Only allow admins to enable 5-second refresh.

**Pros:**
- Prevents misuse by regular users

**Cons:**
- Limits flexibility
- Complex permission model
- Not aligned with Superset's user-empowerment philosophy

### Approach C: Direct Addition with Warning (Chosen)

Add the option with a visible warning.

**Pros:**
- Simple implementation
- User choice
- Warning informs about implications
- Consistent with existing patterns

**Cons:**
- Users may ignore warning
- Could impact shared deployments

## Rollback Plan

If 5-second refresh causes issues:

1. Remove `[5, "5 seconds"]` from backend config
2. Change `MINIMUM_REFRESH_INTERVAL` back to 10
3. Remove 5-second option from frontend
4. Users with 5-second interval will get validation error, need to select new interval

## Future Enhancements

1. **Per-Dashboard Limits**: Allow admins to set minimum refresh interval per dashboard
2. **Load-Based Throttling**: Automatically increase refresh interval under high load
3. **Chart-Level Refresh**: Allow different charts to refresh at different rates
4. **WebSocket Updates**: Push updates to clients instead of polling
