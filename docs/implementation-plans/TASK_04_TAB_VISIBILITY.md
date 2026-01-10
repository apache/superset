# Task 4: Implement Tab Visibility Auto-Pause

## Overview

Automatically pause auto-refresh when the browser tab becomes inactive (hidden) and resume when the user returns to the tab. This saves server resources and prevents unnecessary data fetching when the user isn't viewing the dashboard.

## Current Implementation

### Existing Visibility Handling

**File:** `superset-frontend/src/preamble.ts` (lines 102-109)

Basic session validation on tab visibility:

```typescript
if (bootstrapData.user?.isActive) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      getMe().catch(() => {
        // SupersetClient will redirect to login on 401
      });
    }
  });
}
```

**File:** `superset-frontend/src/dashboard/components/Dashboard.jsx` (lines 194-209)

Analytics logging for tab visibility:

```javascript
onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // from visible to hidden
    this.visibilityEventData = {
      start_offset: Logger.getTimestamp(),
      ts: new Date().getTime(),
    };
  } else if (document.visibilityState === 'visible') {
    // from hidden to visible
    const logStart = this.visibilityEventData.start_offset;
    this.props.actions.logEvent(LOG_ACTIONS_HIDE_BROWSER_TAB, {
      ...this.visibilityEventData,
      duration: Logger.getTimestamp() - logStart,
    });
  }
}
```

### Page Visibility API

The [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) provides:
- `document.visibilityState`: `'visible'` | `'hidden'` | `'prerender'`
- `document.hidden`: boolean (deprecated but widely supported)
- `visibilitychange` event

Browser support: 98%+ (all modern browsers)

## Implementation Plan

### Step 1: Create Tab Visibility Hook

**File to create:** `superset-frontend/src/dashboard/hooks/useTabVisibility.ts`

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
import { useEffect, useRef, useCallback, useState } from 'react';

export interface UseTabVisibilityOptions {
  /** Callback when tab becomes visible */
  onVisible?: () => void;
  /** Callback when tab becomes hidden */
  onHidden?: () => void;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export interface UseTabVisibilityResult {
  /** Whether the tab is visible */
  isVisible: boolean;
  /** Whether the tab was recently hidden and just became visible */
  wasHidden: boolean;
}

/**
 * Hook to track browser tab visibility state.
 * Uses the Page Visibility API to detect when the user switches tabs.
 *
 * @example
 * ```tsx
 * const { isVisible } = useTabVisibility({
 *   onVisible: () => console.log('Tab is visible'),
 *   onHidden: () => console.log('Tab is hidden'),
 * });
 * ```
 */
export function useTabVisibility({
  onVisible,
  onHidden,
  enabled = true,
}: UseTabVisibilityOptions = {}): UseTabVisibilityResult {
  const [isVisible, setIsVisible] = useState(
    () => document.visibilityState === 'visible',
  );
  const wasHiddenRef = useRef(false);

  // Track previous visibility state to detect transitions
  const previousVisibilityRef = useRef(document.visibilityState);

  const handleVisibilityChange = useCallback(() => {
    const currentVisibility = document.visibilityState;
    const previousVisibility = previousVisibilityRef.current;

    // Update state
    const nowVisible = currentVisibility === 'visible';
    setIsVisible(nowVisible);

    // Detect transition from hidden to visible
    if (previousVisibility === 'hidden' && currentVisibility === 'visible') {
      wasHiddenRef.current = true;
      onVisible?.();
    }
    // Detect transition from visible to hidden
    else if (previousVisibility === 'visible' && currentVisibility === 'hidden') {
      wasHiddenRef.current = false;
      onHidden?.();
    }

    // Update previous state
    previousVisibilityRef.current = currentVisibility;
  }, [onVisible, onHidden]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check initial state
    if (document.visibilityState === 'hidden') {
      wasHiddenRef.current = false;
    }

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, handleVisibilityChange]);

  return {
    isVisible,
    wasHidden: wasHiddenRef.current,
  };
}
```

### Step 2: Create Auto-Pause Hook for Tab Visibility

**File to create:** `superset-frontend/src/dashboard/hooks/useAutoRefreshTabPause.ts`

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
import { useCallback, useRef } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useRealTimeDashboard } from './useRealTimeDashboard';
import { AutoRefreshStatus } from '../types';

export interface UseAutoRefreshTabPauseOptions {
  /** Callback to trigger immediate refresh */
  onRefresh: () => Promise<void>;
  /** Callback to restart the periodic timer */
  onRestartTimer: () => void;
  /** Callback to stop the periodic timer */
  onStopTimer: () => void;
}

/**
 * Hook that automatically pauses auto-refresh when the browser tab is inactive.
 *
 * Behavior:
 * - When tab becomes hidden: Stop the refresh timer, set status to paused
 * - When tab becomes visible: If not manually paused, fetch data immediately and restart timer
 *
 * This hook respects manual pause state - if the user manually paused,
 * returning to the tab won't auto-resume.
 */
export function useAutoRefreshTabPause({
  onRefresh,
  onRestartTimer,
  onStopTimer,
}: UseAutoRefreshTabPauseOptions): void {
  const {
    isRealTimeDashboard,
    isPaused: isManuallyPaused,
    isPausedByTab,
    setPausedByTab,
    setStatus,
    recordSuccess,
    recordError,
  } = useRealTimeDashboard();

  // Track if we need to resume on visibility change
  const shouldResumeRef = useRef(false);

  const handleHidden = useCallback(() => {
    if (!isRealTimeDashboard) {
      return;
    }

    // Don't track tab pause if already manually paused
    if (!isManuallyPaused) {
      shouldResumeRef.current = true;
      setPausedByTab(true);
      setStatus(AutoRefreshStatus.Paused);
      onStopTimer();
    }
  }, [
    isRealTimeDashboard,
    isManuallyPaused,
    setPausedByTab,
    setStatus,
    onStopTimer,
  ]);

  const handleVisible = useCallback(() => {
    if (!isRealTimeDashboard) {
      return;
    }

    // Only resume if we paused due to tab visibility (not manual pause)
    if (isPausedByTab && shouldResumeRef.current && !isManuallyPaused) {
      setPausedByTab(false);
      setStatus(AutoRefreshStatus.Fetching);

      // Immediate refresh then restart timer
      onRefresh()
        .then(() => {
          recordSuccess();
          onRestartTimer();
        })
        .catch(error => {
          recordError(error?.message || 'Refresh failed');
          // Still restart timer even on error
          onRestartTimer();
        });

      shouldResumeRef.current = false;
    }
  }, [
    isRealTimeDashboard,
    isPausedByTab,
    isManuallyPaused,
    setPausedByTab,
    setStatus,
    onRefresh,
    onRestartTimer,
    recordSuccess,
    recordError,
  ]);

  // Use the tab visibility hook
  useTabVisibility({
    onVisible: handleVisible,
    onHidden: handleHidden,
    enabled: isRealTimeDashboard,
  });
}
```

### Step 3: Integrate into Header Component

**File to modify:** `superset-frontend/src/dashboard/components/Header/index.jsx`

#### 3a. Import the new hook

Add import (around line 60):

```javascript
import { useAutoRefreshTabPause } from '../../hooks/useAutoRefreshTabPause';
```

#### 3b. Create callbacks for the hook

Add after the existing `handlePauseToggle` callback (from Task 3):

```javascript
/**
 * Callback to trigger immediate refresh for tab visibility hook.
 * Returns a promise that resolves when refresh completes.
 */
const handleTabVisibilityRefresh = useCallback(() => {
  return new Promise((resolve, reject) => {
    if (!isLoading) {
      boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id)
        .then(resolve)
        .catch(reject);
    } else {
      // If already loading, resolve immediately
      resolve();
    }
  });
}, [boundActionCreators, chartIds, dashboardInfo.id, isLoading]);

/**
 * Callback to restart the periodic timer.
 */
const handleRestartTimer = useCallback(() => {
  startPeriodicRender(refreshFrequency * 1000);
}, [startPeriodicRender, refreshFrequency]);

/**
 * Callback to stop the periodic timer.
 */
const handleStopTimer = useCallback(() => {
  stopPeriodicRender(refreshTimer.current);
  refreshTimer.current = 0;
}, []);
```

#### 3c. Use the auto-pause hook

Add after the callbacks (before the return statement):

```javascript
// Auto-pause when browser tab is inactive
useAutoRefreshTabPause({
  onRefresh: handleTabVisibilityRefresh,
  onRestartTimer: handleRestartTimer,
  onStopTimer: handleStopTimer,
});
```

### Step 4: Update Status Indicator Tooltip for Tab Pause

**File to modify:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusTooltipContent.tsx`

Update the `getStatusMessage` function to handle tab-paused state:

```typescript
const getStatusMessage = (
  status: AutoRefreshStatus,
  lastSuccessfulRefresh: number | null,
  lastError: string | null,
  refreshFrequency: number,
  isPausedByTab: boolean,  // NEW parameter
): string => {
  switch (status) {
    case AutoRefreshStatus.Paused:
      // Differentiate between manual and tab pause
      return isPausedByTab
        ? t('Auto-refresh paused (tab inactive)')
        : t('Auto-refresh paused');
    // ... rest of cases unchanged
  }
};
```

Update the component to receive and pass `isPausedByTab`:

```typescript
export interface StatusTooltipContentProps {
  // ... existing props
  /** Whether paused due to tab visibility */
  isPausedByTab?: boolean;
}

export const StatusTooltipContent: FC<StatusTooltipContentProps> = ({
  status,
  lastSuccessfulRefresh,
  lastError,
  refreshFrequency,
  isPausedByTab = false,
}) => {
  // ...
  const message = getStatusMessage(
    status,
    lastSuccessfulRefresh,
    lastError,
    refreshFrequency,
    isPausedByTab,
  );
  // ...
};
```

Update the parent `AutoRefreshStatus` component to pass the prop:

```typescript
// In AutoRefreshStatus/index.tsx
const {
  // ... existing destructuring
  isPausedByTab,
} = useRealTimeDashboard();

return (
  <Tooltip
    title={
      <StatusTooltipContent
        status={effectiveStatus}
        lastSuccessfulRefresh={lastSuccessfulRefresh}
        lastError={lastError}
        refreshFrequency={refreshFrequency}
        isPausedByTab={isPausedByTab}  // NEW
      />
    }
  >
    {/* ... */}
  </Tooltip>
);
```

### Step 5: Create Unit Tests

**File to create:** `superset-frontend/src/dashboard/hooks/useTabVisibility.test.ts`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { useTabVisibility } from './useTabVisibility';

describe('useTabVisibility', () => {
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Save original
    originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    );
  });

  afterEach(() => {
    // Restore original
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });

  const mockVisibilityState = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
  };

  const fireVisibilityChange = () => {
    document.dispatchEvent(new Event('visibilitychange'));
  };

  test('returns initial visibility state', () => {
    mockVisibilityState('visible');
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current.isVisible).toBe(true);
  });

  test('calls onHidden when tab becomes hidden', () => {
    mockVisibilityState('visible');
    const onHidden = jest.fn();
    const onVisible = jest.fn();

    renderHook(() => useTabVisibility({ onHidden, onVisible }));

    // Simulate tab becoming hidden
    act(() => {
      mockVisibilityState('hidden');
      fireVisibilityChange();
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
    expect(onVisible).not.toHaveBeenCalled();
  });

  test('calls onVisible when tab becomes visible', () => {
    mockVisibilityState('hidden');
    const onHidden = jest.fn();
    const onVisible = jest.fn();

    renderHook(() => useTabVisibility({ onHidden, onVisible }));

    // Simulate tab becoming visible
    act(() => {
      mockVisibilityState('visible');
      fireVisibilityChange();
    });

    expect(onVisible).toHaveBeenCalledTimes(1);
    expect(onHidden).not.toHaveBeenCalled();
  });

  test('does not add listener when disabled', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    renderHook(() => useTabVisibility({ enabled: false }));

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    addEventListenerSpy.mockRestore();
  });

  test('removes listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useTabVisibility());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
```

**File to create:** `superset-frontend/src/dashboard/hooks/useAutoRefreshTabPause.test.ts`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { ReactNode } from 'react';
import { useAutoRefreshTabPause } from './useAutoRefreshTabPause';
import { AutoRefreshStatus } from '../types';

const createMockStore = (dashboardState = {}) =>
  createStore(() => ({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Success,
      autoRefreshPaused: false,
      autoRefreshPausedByTab: false,
      ...dashboardState,
    },
  }));

const createWrapper =
  (store: ReturnType<typeof createMockStore>) =>
  ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

describe('useAutoRefreshTabPause', () => {
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });

  test('does nothing when not a real-time dashboard', () => {
    const store = createMockStore({ refreshFrequency: 0 });
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onRestartTimer = jest.fn();
    const onStopTimer = jest.fn();

    renderHook(
      () =>
        useAutoRefreshTabPause({
          onRefresh,
          onRestartTimer,
          onStopTimer,
        }),
      { wrapper: createWrapper(store) },
    );

    // Simulate tab hidden
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onStopTimer).not.toHaveBeenCalled();
  });

  test('stops timer when tab becomes hidden', () => {
    const store = createMockStore({ refreshFrequency: 5 });
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onRestartTimer = jest.fn();
    const onStopTimer = jest.fn();

    renderHook(
      () =>
        useAutoRefreshTabPause({
          onRefresh,
          onRestartTimer,
          onStopTimer,
        }),
      { wrapper: createWrapper(store) },
    );

    // Simulate tab hidden
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onStopTimer).toHaveBeenCalledTimes(1);
  });

  test('does not pause when manually paused', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshPaused: true,
    });
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onRestartTimer = jest.fn();
    const onStopTimer = jest.fn();

    renderHook(
      () =>
        useAutoRefreshTabPause({
          onRefresh,
          onRestartTimer,
          onStopTimer,
        }),
      { wrapper: createWrapper(store) },
    );

    // Simulate tab hidden
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should not stop timer because already manually paused
    expect(onStopTimer).not.toHaveBeenCalled();
  });
});
```

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/hooks/useTabVisibility.ts` | Generic tab visibility hook |
| `superset-frontend/src/dashboard/hooks/useAutoRefreshTabPause.ts` | Auto-pause logic for tab visibility |
| `superset-frontend/src/dashboard/hooks/useTabVisibility.test.ts` | Unit tests for visibility hook |
| `superset-frontend/src/dashboard/hooks/useAutoRefreshTabPause.test.ts` | Unit tests for auto-pause hook |

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Integrate `useAutoRefreshTabPause` hook |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusTooltipContent.tsx` | Add tab-paused tooltip message |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/index.tsx` | Pass `isPausedByTab` to tooltip |

## Behavior Specification

### Tab Becomes Hidden

1. `visibilitychange` event fires with `hidden` state
2. Check if dashboard is real-time AND not manually paused
3. Set `autoRefreshPausedByTab: true`
4. Set `autoRefreshStatus: 'paused'`
5. Stop the periodic timer
6. Status indicator shows gray "paused" dot
7. Tooltip shows "Auto-refresh paused (tab inactive)"

### Tab Becomes Visible

1. `visibilitychange` event fires with `visible` state
2. Check if was paused by tab (not manually paused)
3. Set `autoRefreshPausedByTab: false`
4. Set `autoRefreshStatus: 'fetching'`
5. Trigger immediate data refresh
6. On success: `recordSuccess()`, restart timer
7. On failure: `recordError()`, restart timer anyway
8. Status indicator shows appropriate color

### Interaction with Manual Pause

| Scenario | Hidden Behavior | Visible Behavior |
|----------|-----------------|------------------|
| Not manually paused | Pause by tab | Resume and refresh |
| Manually paused | Do nothing | Do nothing |
| Tab-paused, then manually paused | Already paused | Stay paused |
| Tab-paused, then manually resumed | Resume | Already running |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Tab hidden during fetch | Let fetch complete, don't restart timer |
| Quick tab switch (hidden → visible in <100ms) | Still trigger refresh |
| Multiple rapid visibility changes | Debounce via React state updates |
| Tab hidden before dashboard loads | Start paused, resume on visible |

## Dependencies

### Depends On
- **Task 1**: State management (`autoRefreshPausedByTab`, `setPausedByTab`)
- **Task 2**: Status indicator (paused state display)
- **Task 3**: Pause/resume logic patterns

### Browser API
- Page Visibility API: 98%+ browser support
- Fallback not needed for modern browsers

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Should auto-pause on inactive tab be configurable? | No - always on (saves server resources) |
| Show different indicator for tab pause vs manual pause? | Yes - tooltip shows "(tab inactive)" |
| Resume if user manually paused before tab hidden? | No - respect manual pause |

## Accessibility

- Status indicator tooltip clearly states "tab inactive"
- No jarring visual changes on tab restore
- Screen readers can access pause state via `aria-label`

## Performance Considerations

- Page Visibility API is highly efficient (passive event)
- No polling or timers for visibility detection
- Immediate cleanup on unmount
- Minimal re-renders (state updates only on actual changes)
