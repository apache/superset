# Task 3: Implement Pause/Resume Controls

## Overview

Add pause/resume functionality for auto-refresh with header controls. When paused, the periodic refresh timer stops. When resumed, the dashboard immediately fetches the latest data and restarts the interval timer.

## Current Implementation

### Periodic Runner Utility

**File:** `superset-frontend/src/dashboard/util/setPeriodicRunner.ts`

```typescript
export const stopPeriodicRender = (refreshTimer?: number) => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
};

export default function setPeriodicRunner({
  interval = 0,
  periodicRender,
  refreshTimer,
}: SetPeriodicRunnerProps) {
  stopPeriodicRender(refreshTimer);
  if (interval > 0) {
    return setInterval(periodicRender, interval);
  }
  return 0;
}
```

### Header Component Refresh Logic

**File:** `superset-frontend/src/dashboard/components/Header/index.jsx`

Key elements:
- `refreshTimer` ref (line 218): Stores the interval ID
- `startPeriodicRender` callback (lines 261-322): Creates the periodic refresh
- `forceRefresh` callback (lines 393-403): Triggers immediate refresh
- Cleanup effect (lines 351-359): Stops timer on unmount

```javascript
// Refresh timer ref
const refreshTimer = useRef(0);

// Start periodic refresh
const startPeriodicRender = useCallback(
  interval => {
    // ...setup...
    refreshTimer.current = setPeriodicRunner({
      interval,
      periodicRender,
      refreshTimer: refreshTimer.current,
    });
  },
  [boundActionCreators, chartIds, dashboardInfo],
);

// Force immediate refresh
const forceRefresh = useCallback(() => {
  if (!isLoading) {
    boundActionCreators.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
      force: true,
      interval: 0,
      chartCount: chartIds.length,
    });
    return boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id);
  }
  return false;
}, [boundActionCreators, chartIds, dashboardInfo.id, isLoading]);

// Effect to restart timer when frequency changes
useEffect(() => {
  startPeriodicRender(refreshFrequency * 1000);
}, [refreshFrequency, startPeriodicRender]);
```

### Header Actions Menu

**File:** `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx`

Menu items defined in `useMemo` (lines 181-302):
- "Refresh dashboard" triggers `forceRefreshAllCharts()`
- "Set auto-refresh" opens the refresh modal

## Implementation Plan

### Step 1: Add New MenuKey for Pause Toggle

**File to modify:** `superset-frontend/src/dashboard/types.ts`

Add new menu key (around line 304):

```typescript
export enum MenuKeys {
  // ... existing keys ...
  RefreshDashboard = 'refresh_dashboard',
  AutorefreshModal = 'autorefresh_modal',
  // NEW: Pause/resume auto-refresh
  ToggleAutoRefreshPause = 'toggle_auto_refresh_pause',
  // ... rest of keys ...
}
```

### Step 2: Update Header Component with Pause Logic

**File to modify:** `superset-frontend/src/dashboard/components/Header/index.jsx`

#### 2a. Import the hook and types

Add imports (around line 46):

```javascript
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { AutoRefreshStatus } from '../../types';
```

#### 2b. Use the real-time dashboard hook

Add inside the Header component (after existing hook calls, around line 216):

```javascript
const {
  isRealTimeDashboard,
  isPaused,
  effectiveStatus,
  setPaused,
  setStatus,
  recordSuccess,
  recordError,
} = useRealTimeDashboard();
```

#### 2c. Create pause/resume handler

Add new callback (after `forceRefresh`, around line 404):

```javascript
/**
 * Handles toggling the auto-refresh pause state.
 * When pausing: Stops the periodic timer
 * When resuming: Immediately fetches data, then restarts the timer
 */
const handlePauseToggle = useCallback(() => {
  if (isPaused) {
    // Resume: fetch immediately, then restart timer
    setPaused(false);
    setStatus(AutoRefreshStatus.Fetching);

    // Immediate refresh
    boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id)
      .then(() => {
        recordSuccess();
        // Restart the periodic timer
        startPeriodicRender(refreshFrequency * 1000);
      })
      .catch((error) => {
        recordError(error?.message || 'Refresh failed');
      });
  } else {
    // Pause: stop the timer
    setPaused(true);
    setStatus(AutoRefreshStatus.Paused);
    stopPeriodicRender(refreshTimer.current);
    refreshTimer.current = 0;
  }
}, [
  isPaused,
  setPaused,
  setStatus,
  recordSuccess,
  recordError,
  boundActionCreators,
  chartIds,
  dashboardInfo.id,
  refreshFrequency,
  startPeriodicRender,
]);
```

#### 2d. Update startPeriodicRender to track status

Modify the `startPeriodicRender` callback (lines 261-322) to update the real-time status:

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

      // NEW: Update status to fetching
      setStatus(AutoRefreshStatus.Fetching);

      // NOTE: Toast suppressed for real-time dashboards (moved to Task 7)
      // boundActionCreators.addWarningToast(...);

      const fetchPromise =
        dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
          ? fetchCharts(affectedCharts)
          : fetchCharts(affectedCharts, true);

      // NEW: Track success/failure
      return fetchPromise
        .then(() => {
          recordSuccess();
        })
        .catch((error) => {
          recordError(error?.message || 'Refresh failed');
        });
    };

    refreshTimer.current = setPeriodicRunner({
      interval,
      periodicRender,
      refreshTimer: refreshTimer.current,
    });
  },
  [boundActionCreators, chartIds, dashboardInfo, setStatus, recordSuccess, recordError],
);
```

#### 2e. Update the useEffect to respect pause state

Modify the effect that starts the periodic render (lines 324-326):

```javascript
useEffect(() => {
  // Don't restart timer if paused
  if (!isPaused) {
    startPeriodicRender(refreshFrequency * 1000);
  }
}, [refreshFrequency, startPeriodicRender, isPaused]);
```

#### 2f. Pass pause handler to the menu hook

Update the `useHeaderActionsMenu` call (around line 760-790) to include the pause toggle:

```javascript
const [menu, isDropdownVisible, setIsDropdownVisible] = useHeaderActionsMenu({
  // ... existing props ...
  forceRefreshAllCharts: forceRefresh,
  refreshFrequency,
  // NEW: Add pause-related props
  isAutoRefreshPaused: isPaused,
  isRealTimeDashboard,
  onToggleAutoRefreshPause: handlePauseToggle,
  // ... rest of props ...
});
```

### Step 3: Update Menu Hook Types

**File to modify:** `superset-frontend/src/dashboard/components/Header/types.ts`

Add new props to `HeaderDropdownProps` interface:

```typescript
export interface HeaderDropdownProps {
  // ... existing props ...

  /** Whether auto-refresh is paused */
  isAutoRefreshPaused?: boolean;
  /** Whether this is a real-time dashboard (refreshFrequency > 0) */
  isRealTimeDashboard?: boolean;
  /** Callback to toggle auto-refresh pause state */
  onToggleAutoRefreshPause?: () => void;
}
```

### Step 4: Update Menu Hook to Show Pause/Resume Option

**File to modify:** `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx`

#### 4a. Update function signature

Add new props (around line 39):

```typescript
export const useHeaderActionsMenu = ({
  // ... existing props ...
  isAutoRefreshPaused,
  isRealTimeDashboard,
  onToggleAutoRefreshPause,
}: HeaderDropdownProps) => {
```

#### 4b. Add menu click handler for pause

Update `handleMenuClick` (around line 80):

```typescript
const handleMenuClick = useCallback(
  ({ key }: { key: string }) => {
    switch (key) {
      case MenuKeys.RefreshDashboard:
        forceRefreshAllCharts();
        addSuccessToast(t('Refreshing charts'));
        break;
      // NEW: Handle pause toggle
      case MenuKeys.ToggleAutoRefreshPause:
        onToggleAutoRefreshPause?.();
        break;
      case MenuKeys.EditProperties:
        // ... rest of cases ...
    }
    setIsDropdownVisible(false);
  },
  [
    forceRefreshAllCharts,
    addSuccessToast,
    onToggleAutoRefreshPause,  // NEW
    showPropertiesModal,
    showRefreshModal,
    manageEmbedded,
  ],
);
```

#### 4c. Add pause/resume menu item

Update the menu items construction (inside `useMemo`, around line 187-199):

```typescript
// Refresh dashboard
if (!editMode) {
  menuItems.push({
    key: MenuKeys.RefreshDashboard,
    label: t('Refresh dashboard'),
    disabled: isLoading,
  });

  // NEW: Pause/Resume auto-refresh (only for real-time dashboards)
  if (isRealTimeDashboard) {
    menuItems.push({
      key: MenuKeys.ToggleAutoRefreshPause,
      label: isAutoRefreshPaused
        ? t('Resume auto-refresh')
        : t('Pause auto-refresh'),
      disabled: isLoading,
    });
  }

  // Auto-refresh settings (session-only in view mode)
  menuItems.push({
    key: MenuKeys.AutorefreshModal,
    label: t('Set auto-refresh'),
    disabled: isLoading,
  });
}
```

#### 4d. Update useMemo dependencies

Add new dependencies to the `useMemo` call:

```typescript
}, [
  // ... existing deps ...
  isAutoRefreshPaused,  // NEW
  isRealTimeDashboard,  // NEW
]);
```

### Step 5: (Optional) Add Pause Button in Header Panel

For better UX, add a dedicated pause/play button near the status indicator instead of (or in addition to) the menu item.

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshControls/index.tsx`

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
import { FC, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Tooltip, Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';

export interface AutoRefreshControlsProps {
  /** Callback when pause/resume is toggled */
  onTogglePause: () => void;
  /** Whether the dashboard is loading */
  isLoading?: boolean;
}

/**
 * Pause/Resume button for real-time dashboards.
 * Only renders when auto-refresh is enabled.
 */
export const AutoRefreshControls: FC<AutoRefreshControlsProps> = ({
  onTogglePause,
  isLoading,
}) => {
  const theme = useTheme();
  const { isRealTimeDashboard, isPaused } = useRealTimeDashboard();

  // Don't render if not a real-time dashboard
  if (!isRealTimeDashboard) {
    return null;
  }

  const buttonStyles = css`
    margin-left: ${theme.marginXS}px;
    padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: ${theme.controlHeight}px;
    height: ${theme.controlHeight}px;
  `;

  const tooltipTitle = isPaused
    ? t('Resume auto-refresh')
    : t('Pause auto-refresh');

  const Icon = isPaused ? Icons.PlayCircleOutlined : Icons.PauseCircleOutlined;

  return (
    <Tooltip title={tooltipTitle} placement="bottom">
      <Button
        css={buttonStyles}
        buttonStyle="link"
        onClick={onTogglePause}
        disabled={isLoading}
        aria-label={tooltipTitle}
        data-test="auto-refresh-toggle"
      >
        <Icon iconSize="l" />
      </Button>
    </Tooltip>
  );
};

export default AutoRefreshControls;
```

**Integration in Header** (optional alternative to menu item):

```javascript
// In Header component, add to titlePanelAdditionalItems or rightPanelAdditionalItems
const titlePanelAdditionalItems = useMemo(
  () => [
    !editMode && (
      <PublishedStatus {...} />
    ),
    !editMode && <AutoRefreshStatus key="auto-refresh-status" />,
    !editMode && (
      <AutoRefreshControls
        key="auto-refresh-controls"
        onTogglePause={handlePauseToggle}
        isLoading={isLoading}
      />
    ),
    !editMode && !isEmbedded && metadataBar,
  ],
  [/* deps including handlePauseToggle, isLoading */],
);
```

### Step 6: Create Unit Tests

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshControls/AutoRefreshControls.test.tsx`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import AutoRefreshControls from '.';
import { AutoRefreshStatus } from '../../types';

const createMockStore = (dashboardState = {}) =>
  createStore(() => ({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Success,
      autoRefreshPaused: false,
      ...dashboardState,
    },
  }));

describe('AutoRefreshControls', () => {
  test('does not render when refreshFrequency is 0', () => {
    const store = createMockStore({ refreshFrequency: 0 });
    const onTogglePause = jest.fn();

    render(
      <Provider store={store}>
        <AutoRefreshControls onTogglePause={onTogglePause} />
      </Provider>,
    );

    expect(screen.queryByTestId('auto-refresh-toggle')).not.toBeInTheDocument();
  });

  test('renders pause button when not paused', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshPaused: false,
    });
    const onTogglePause = jest.fn();

    render(
      <Provider store={store}>
        <AutoRefreshControls onTogglePause={onTogglePause} />
      </Provider>,
    );

    const button = screen.getByTestId('auto-refresh-toggle');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Pause auto-refresh');
  });

  test('renders play button when paused', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshPaused: true,
    });
    const onTogglePause = jest.fn();

    render(
      <Provider store={store}>
        <AutoRefreshControls onTogglePause={onTogglePause} />
      </Provider>,
    );

    const button = screen.getByTestId('auto-refresh-toggle');
    expect(button).toHaveAttribute('aria-label', 'Resume auto-refresh');
  });

  test('calls onTogglePause when clicked', () => {
    const store = createMockStore({ refreshFrequency: 5 });
    const onTogglePause = jest.fn();

    render(
      <Provider store={store}>
        <AutoRefreshControls onTogglePause={onTogglePause} />
      </Provider>,
    );

    fireEvent.click(screen.getByTestId('auto-refresh-toggle'));
    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  test('is disabled when isLoading is true', () => {
    const store = createMockStore({ refreshFrequency: 5 });
    const onTogglePause = jest.fn();

    render(
      <Provider store={store}>
        <AutoRefreshControls onTogglePause={onTogglePause} isLoading />
      </Provider>,
    );

    const button = screen.getByTestId('auto-refresh-toggle');
    expect(button).toBeDisabled();
  });
});
```

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/components/AutoRefreshControls/index.tsx` | Pause/Resume button component (optional) |
| `superset-frontend/src/dashboard/components/AutoRefreshControls/AutoRefreshControls.test.tsx` | Unit tests |

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/types.ts` | Add `ToggleAutoRefreshPause` to `MenuKeys` enum |
| `superset-frontend/src/dashboard/components/Header/types.ts` | Add pause-related props to `HeaderDropdownProps` |
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Add pause handler, update periodic render logic |
| `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx` | Add pause/resume menu item |

## Behavior Specification

### Pause Behavior

1. User clicks "Pause auto-refresh" in menu or pause button
2. `setPaused(true)` dispatches Redux action
3. Status indicator shows "paused" (gray)
4. `stopPeriodicRender()` clears the interval
5. `refreshTimer.current` is set to 0
6. Dashboard stops auto-refreshing
7. Manual "Refresh dashboard" still works

### Resume Behavior

1. User clicks "Resume auto-refresh" in menu or play button
2. `setPaused(false)` dispatches Redux action
3. Status indicator shows "fetching" (blue)
4. Immediate refresh triggered via `onRefresh()`
5. On success: `recordSuccess()` updates timestamp
6. `startPeriodicRender()` restarts the interval
7. Status indicator shows "success" (green)

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Pause while fetching | Stop timer, let current fetch complete |
| Resume while loading | Disabled (button/menu item disabled during load) |
| Change refresh frequency while paused | Update frequency but don't start timer |
| Set frequency to 0 while paused | Clear paused state, hide controls |

## Integration with Other Tasks

### Depends On
- **Task 1**: State management (`useRealTimeDashboard` hook, Redux actions)
- **Task 2**: Status indicator (visual feedback)

### Used By
- **Task 4**: Tab visibility auto-pause (will call `setPausedByTab` instead of `setPaused`)
- **Task 7**: Toast suppression (periodic render won't show toasts)

## Accessibility

- Button has `aria-label` describing action
- Tooltip provides visual confirmation
- Disabled state properly communicated
- Menu item follows Ant Design Menu patterns

## Manual Refresh Icon Behavior

**Requirement:**
> Refresh icon - Triggers an immediate hard refresh - Retains existing auto-refresh interval settings

The existing "Refresh dashboard" menu item and `forceRefresh` callback must:

1. **Trigger immediate data fetch** without clearing the auto-refresh interval
2. **Update status indicator** to show "Fetching" during the manual refresh
3. **Record success/error** for the status indicator

**Implementation Note:**
The existing `forceRefresh` callback should be enhanced:

```typescript
const forceRefresh = useCallback(() => {
  if (!isLoading) {
    // Update status indicator to show fetching
    boundActionCreators.setAutoRefreshStatus(AutoRefreshStatus.Fetching);
    boundActionCreators.setAutoRefreshFetchStartTime(Date.now());

    boundActionCreators.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
      force: true,
      interval: 0,
      chartCount: chartIds.length,
    });

    return boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id)
      .then(() => {
        boundActionCreators.recordAutoRefreshSuccess();
      })
      .catch((error) => {
        boundActionCreators.recordAutoRefreshError(error?.message || 'Refresh failed');
      })
      .finally(() => {
        boundActionCreators.setAutoRefreshFetchStartTime(null);
      });
  }
  return false;
}, [boundActionCreators, chartIds, dashboardInfo.id, isLoading]);
```

**IMPORTANT:** The manual refresh does NOT:
- Clear the `refreshFrequency`
- Change the `autoRefreshPaused` state
- Reset the periodic timer (it continues on its schedule)

## Testing Strategy

1. **Unit tests**: AutoRefreshControls component
2. **Integration tests**: Header with pause handler
3. **E2E tests**: Full pause/resume flow (in Task 10)
4. **Manual refresh tests**: Verify refresh icon doesn't affect auto-refresh settings
