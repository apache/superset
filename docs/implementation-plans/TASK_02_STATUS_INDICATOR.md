# Task 2: Implement Auto-Refresh Status Indicator Component

## Overview

Create a visual status indicator for the dashboard header that shows the current state of auto-refresh cycles. The indicator should display different states (success, fetching, delayed, error, paused) with appropriate colors and tooltips.

## Current Implementation

### Header Structure

**File:** `superset-frontend/src/dashboard/components/Header/index.jsx`

The `titlePanelAdditionalItems` prop (lines 608-632) is passed to `PageHeaderWithActions` and rendered after the FaveStar icon. This is where our status indicator will be added.

```jsx
const titlePanelAdditionalItems = useMemo(
  () => [
    !editMode && (
      <PublishedStatus
        dashboardId={dashboardInfo.id}
        isPublished={isPublished}
        savePublished={boundActionCreators.savePublished}
        userCanEdit={userCanEdit}
        userCanSave={userCanSaveAs}
        visible={!editMode}
      />
    ),
    !editMode && !isEmbedded && metadataBar,
    // NEW: AutoRefreshStatus will be added here
  ],
  [/* deps */],
);
```

### PageHeaderWithActions Layout

**File:** `superset-frontend/packages/superset-ui-core/src/components/PageHeaderWithActions/index.tsx`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TITLE PANEL                              │     RIGHT PANEL             │
│  ┌─────────────────────────────────────┐  │  ┌──────────────────────┐  │
│  │ Title │ CertifiedBadge │ FaveStar   │  │  │ rightPanelItems      │  │
│  │       │ titlePanelAdditionalItems   │  │  │ Menu Dropdown        │  │
│  │       │ [PublishedStatus]           │  │  │                      │  │
│  │       │ [MetadataBar]               │  │  │                      │  │
│  │       │ [NEW: AutoRefreshStatus]    │  │  │                      │  │
│  └─────────────────────────────────────┘  │  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Existing Patterns

**PublishedStatus Component** (`superset-frontend/src/dashboard/components/PublishedStatus/index.tsx`)
- Uses `Tooltip` wrapper around `PublishedLabel`
- Conditional rendering based on state
- Uses `@superset-ui/core/components` imports

**CachedLabel Component** (`superset-frontend/packages/superset-ui-core/src/components/CachedLabel/`)
- Uses `Label` component with icon
- `Tooltip` with `TooltipContent` for timestamp
- Uses `extendedDayjs.fromNow()` for relative time

**Label Component** (`superset-frontend/packages/superset-ui-core/src/components/Label/`)
- Supports types: `'success' | 'warning' | 'error' | 'info' | 'default' | 'primary'`
- Uses `getColorVariants()` for theme-aware colors
- Supports icons via `icon` prop

### Available Icons

From `superset-frontend/packages/superset-ui-core/src/components/Icons/`:
- `CheckCircleOutlined` / `CheckCircleFilled` - Success state
- `SyncOutlined` - Fetching/refreshing state
- `ExclamationCircleOutlined` - Warning/delayed state
- `CloseCircleOutlined` - Error state
- `PauseCircleOutlined` - Paused state (need to verify availability)
- `CircleSolid` - Custom icon (can be used as a colored dot)

## Implementation Plan

### Step 1: Create Status Indicator Component

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/index.tsx`

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
import { FC, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Tooltip } from '@superset-ui/core/components';
import { useRealTimeDashboard } from '../../hooks/useRealTimeDashboard';
import { AutoRefreshStatus as StatusEnum } from '../../types';
import { StatusIndicatorDot } from './StatusIndicatorDot';
import { StatusTooltipContent } from './StatusTooltipContent';

export interface AutoRefreshStatusProps {
  /** Additional CSS class name */
  className?: string;
}

/**
 * Auto-refresh status indicator displayed in the dashboard header.
 * Only renders when the dashboard has an auto-refresh interval configured.
 *
 * Shows different colored dots based on refresh state:
 * - Green (success): Last refresh was successful
 * - Blue (fetching): Currently fetching data
 * - Yellow (delayed): Refresh is taking longer than expected
 * - Red (error): Refresh failed with an error
 * - Gray (paused): Auto-refresh is paused
 */
export const AutoRefreshStatus: FC<AutoRefreshStatusProps> = ({ className }) => {
  const {
    isRealTimeDashboard,
    effectiveStatus,
    lastSuccessfulRefresh,
    lastError,
    refreshFrequency,
  } = useRealTimeDashboard();

  // Don't render if not a real-time dashboard
  if (!isRealTimeDashboard) {
    return null;
  }

  return (
    <Tooltip
      id="auto-refresh-status-tooltip"
      placement="bottom"
      title={
        <StatusTooltipContent
          status={effectiveStatus}
          lastSuccessfulRefresh={lastSuccessfulRefresh}
          lastError={lastError}
          refreshFrequency={refreshFrequency}
        />
      }
    >
      <div className={className} data-test="auto-refresh-status">
        <StatusIndicatorDot status={effectiveStatus} />
      </div>
    </Tooltip>
  );
};

export default AutoRefreshStatus;
```

### Step 2: Create Status Indicator Dot Component

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusIndicatorDot.tsx`

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
import { FC, useMemo, useRef, useEffect, useState } from 'react';
import { css, useTheme } from '@apache-superset/core/ui';
import { AutoRefreshStatus } from '../../types';

export interface StatusIndicatorDotProps {
  /** Current status to display */
  status: AutoRefreshStatus;
  /** Size of the dot in pixels */
  size?: number;
}

/**
 * Get the color for a given status from theme tokens.
 * Uses Ant Design semantic color tokens for consistency.
 */
const getStatusColor = (
  theme: ReturnType<typeof useTheme>,
  status: AutoRefreshStatus,
): string => {
  switch (status) {
    case AutoRefreshStatus.Success:
    case AutoRefreshStatus.Idle:
      return theme.colorSuccess;
    case AutoRefreshStatus.Fetching:
      return theme.colorPrimary;
    case AutoRefreshStatus.Delayed:
      return theme.colorWarning;
    case AutoRefreshStatus.Error:
      return theme.colorError;
    case AutoRefreshStatus.Paused:
      return theme.colorTextSecondary;
    default:
      return theme.colorTextSecondary;
  }
};

/**
 * A colored dot indicator that shows the auto-refresh status.
 *
 * CRITICAL: Uses CSS transitions to prevent flickering between states.
 * The color change is animated smoothly rather than instantly re-rendering.
 */
export const StatusIndicatorDot: FC<StatusIndicatorDotProps> = ({
  status,
  size = 10,
}) => {
  const theme = useTheme();

  // Debounce rapid status changes to prevent flickering
  // This ensures the dot color doesn't flash during quick state transitions
  const [displayStatus, setDisplayStatus] = useState(status);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // For fetching state, update immediately to show user something is happening
    if (status === AutoRefreshStatus.Fetching) {
      setDisplayStatus(status);
    } else {
      // For other states, debounce to prevent flickering
      timerRef.current = setTimeout(() => {
        setDisplayStatus(status);
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [status]);

  const color = useMemo(
    () => getStatusColor(theme, displayStatus),
    [theme, displayStatus],
  );

  const dotStyles = useMemo(
    () => css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      /* Smooth transition for color changes - prevents flickering */
      transition: background-color ${theme.motionDurationMid} ease-in-out;
      /* Subtle box shadow for better visibility */
      box-shadow: 0 0 0 2px ${theme.colorBgContainer};
      margin-left: ${theme.marginXS}px;
      margin-right: ${theme.marginXS}px;
      cursor: help;

      /* Pulse animation for fetching state */
      ${displayStatus === AutoRefreshStatus.Fetching &&
      css`
        animation: pulse 1.5s ease-in-out infinite;

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}
    `,
    [color, size, theme, displayStatus],
  );

  return (
    <span
      css={dotStyles}
      role="status"
      aria-label={`Auto-refresh status: ${displayStatus}`}
      data-test="status-indicator-dot"
      data-status={displayStatus}
    />
  );
};
```

### Step 3: Create Tooltip Content Component

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusTooltipContent.tsx`

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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { AutoRefreshStatus } from '../../types';

export interface StatusTooltipContentProps {
  /** Current status */
  status: AutoRefreshStatus;
  /** Timestamp of last successful refresh (ms since epoch) */
  lastSuccessfulRefresh: number | null;
  /** Error message from last failed refresh */
  lastError: string | null;
  /** Refresh frequency in seconds */
  refreshFrequency: number;
}

/**
 * Formats a timestamp for display in the tooltip.
 * Shows both relative time ("2 minutes ago") and absolute time.
 */
const formatTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return t('Never');
  }
  return extendedDayjs(timestamp).fromNow();
};

/**
 * Get the status-specific message for the tooltip.
 */
const getStatusMessage = (
  status: AutoRefreshStatus,
  lastSuccessfulRefresh: number | null,
  lastError: string | null,
  refreshFrequency: number,
): string => {
  switch (status) {
    case AutoRefreshStatus.Success:
    case AutoRefreshStatus.Idle:
      return t('Last refreshed: %s', formatTimestamp(lastSuccessfulRefresh));
    case AutoRefreshStatus.Fetching:
      return t('Fetching data...');
    case AutoRefreshStatus.Delayed:
      return t('Refresh delayed. Last successful: %s', formatTimestamp(lastSuccessfulRefresh));
    case AutoRefreshStatus.Error:
      return lastError
        ? t('Error: %s', lastError)
        : t('Refresh failed. Last successful: %s', formatTimestamp(lastSuccessfulRefresh));
    case AutoRefreshStatus.Paused:
      return t('Auto-refresh paused');
    default:
      return t('Auto-refresh every %s seconds', refreshFrequency);
  }
};

/**
 * Tooltip content for the auto-refresh status indicator.
 * Shows contextual information based on the current status.
 */
export const StatusTooltipContent: FC<StatusTooltipContentProps> = ({
  status,
  lastSuccessfulRefresh,
  lastError,
  refreshFrequency,
}) => {
  const theme = useTheme();

  const containerStyles = css`
    max-width: 250px;
    font-size: ${theme.fontSizeSM}px;
  `;

  const titleStyles = css`
    font-weight: ${theme.fontWeightBold};
    margin-bottom: ${theme.marginXXS}px;
  `;

  const messageStyles = css`
    color: ${theme.colorTextSecondary};
  `;

  const statusTitle = {
    [AutoRefreshStatus.Idle]: t('Auto-refresh active'),
    [AutoRefreshStatus.Success]: t('Auto-refresh active'),
    [AutoRefreshStatus.Fetching]: t('Refreshing'),
    [AutoRefreshStatus.Delayed]: t('Refresh delayed'),
    [AutoRefreshStatus.Error]: t('Refresh error'),
    [AutoRefreshStatus.Paused]: t('Paused'),
  }[status] || t('Auto-refresh');

  const message = getStatusMessage(status, lastSuccessfulRefresh, lastError, refreshFrequency);

  return (
    <div css={containerStyles} data-test="status-tooltip-content">
      <div css={titleStyles}>{statusTitle}</div>
      <div css={messageStyles}>{message}</div>
      {refreshFrequency > 0 && status !== AutoRefreshStatus.Paused && (
        <div css={messageStyles}>
          {t('Interval: %s seconds', refreshFrequency)}
        </div>
      )}
    </div>
  );
};
```

### Step 4: Create Types File

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/types.ts`

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
export { AutoRefreshStatus } from '../../types';
```

### Step 5: Update Header Component

**File to modify:** `superset-frontend/src/dashboard/components/Header/index.jsx`

Add import (around line 46):
```javascript
import AutoRefreshStatus from '../AutoRefreshStatus';
```

Update `titlePanelAdditionalItems` (around line 608-632):
```javascript
const titlePanelAdditionalItems = useMemo(
  () => [
    !editMode && (
      <PublishedStatus
        dashboardId={dashboardInfo.id}
        isPublished={isPublished}
        savePublished={boundActionCreators.savePublished}
        userCanEdit={userCanEdit}
        userCanSave={userCanSaveAs}
        visible={!editMode}
      />
    ),
    // NEW: Add AutoRefreshStatus indicator
    !editMode && <AutoRefreshStatus key="auto-refresh-status" />,
    !editMode && !isEmbedded && metadataBar,
  ],
  [
    boundActionCreators.savePublished,
    dashboardInfo.id,
    editMode,
    metadataBar,
    isEmbedded,
    isPublished,
    userCanEdit,
    userCanSaveAs,
  ],
);
```

### Step 6: Create Unit Tests

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/AutoRefreshStatus.test.tsx`

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
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import AutoRefreshStatus from '.';
import { AutoRefreshStatus as StatusEnum } from '../../types';

const createMockStore = (dashboardState = {}) =>
  createStore(() => ({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: StatusEnum.Idle,
      autoRefreshPaused: false,
      autoRefreshPausedByTab: false,
      lastSuccessfulRefresh: Date.now(),
      lastRefreshError: null,
      refreshErrorCount: 0,
      isRefreshing: false,
      ...dashboardState,
    },
  }));

const renderWithStore = (store: ReturnType<typeof createMockStore>) =>
  render(
    <Provider store={store}>
      <AutoRefreshStatus />
    </Provider>,
  );

describe('AutoRefreshStatus', () => {
  test('does not render when refreshFrequency is 0', () => {
    const store = createMockStore({ refreshFrequency: 0 });
    renderWithStore(store);
    expect(screen.queryByTestId('auto-refresh-status')).not.toBeInTheDocument();
  });

  test('renders when refreshFrequency is greater than 0', () => {
    const store = createMockStore({ refreshFrequency: 5 });
    renderWithStore(store);
    expect(screen.getByTestId('auto-refresh-status')).toBeInTheDocument();
  });

  test('shows success status dot', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshStatus: StatusEnum.Success,
    });
    renderWithStore(store);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', StatusEnum.Success);
  });

  test('shows fetching status dot', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshStatus: StatusEnum.Fetching,
    });
    renderWithStore(store);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', StatusEnum.Fetching);
  });

  test('shows paused status when manually paused', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      autoRefreshPaused: true,
    });
    renderWithStore(store);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', StatusEnum.Paused);
  });

  test('shows error status after 3+ consecutive errors', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      refreshErrorCount: 3,
    });
    renderWithStore(store);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', StatusEnum.Error);
  });

  test('shows delayed status after 1-2 consecutive errors', () => {
    const store = createMockStore({
      refreshFrequency: 5,
      refreshErrorCount: 2,
    });
    renderWithStore(store);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', StatusEnum.Delayed);
  });
});
```

**File to create:** `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusIndicatorDot.test.tsx`

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.
 */
import { render, screen, act } from 'spec/helpers/testing-library';
import { StatusIndicatorDot } from './StatusIndicatorDot';
import { AutoRefreshStatus } from '../../types';

describe('StatusIndicatorDot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders with success status', () => {
    render(<StatusIndicatorDot status={AutoRefreshStatus.Success} />);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Success);
  });

  test('debounces status changes except for fetching', async () => {
    const { rerender } = render(
      <StatusIndicatorDot status={AutoRefreshStatus.Success} />,
    );

    // Change to error - should be debounced
    rerender(<StatusIndicatorDot status={AutoRefreshStatus.Error} />);

    // Status should still be success (debounced)
    let dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Success);

    // Fast forward past debounce time
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Now should be error
    dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Error);
  });

  test('fetching status updates immediately without debounce', () => {
    const { rerender } = render(
      <StatusIndicatorDot status={AutoRefreshStatus.Success} />,
    );

    // Change to fetching - should be immediate
    rerender(<StatusIndicatorDot status={AutoRefreshStatus.Fetching} />);

    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Fetching);
  });

  test('has correct accessibility attributes', () => {
    render(<StatusIndicatorDot status={AutoRefreshStatus.Success} />);
    const dot = screen.getByTestId('status-indicator-dot');
    expect(dot).toHaveAttribute('role', 'status');
    expect(dot).toHaveAttribute('aria-label');
  });
});
```

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/index.tsx` | Main component |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusIndicatorDot.tsx` | Colored dot indicator |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusTooltipContent.tsx` | Tooltip content |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/types.ts` | Type re-exports |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/AutoRefreshStatus.test.tsx` | Main component tests |
| `superset-frontend/src/dashboard/components/AutoRefreshStatus/StatusIndicatorDot.test.tsx` | Dot component tests |

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/Header/index.jsx` | Import and add AutoRefreshStatus to titlePanelAdditionalItems |

## Design Decisions

### 1. Anti-Flickering Strategy

The requirement states: "Status indicator color must not blink or flash when transitioning between states."

**Solution:**
- CSS transition on `background-color` for smooth color changes
- Debouncing of status changes (100ms) except for `Fetching` state
- `Fetching` updates immediately so users see feedback right away
- CSS animation for `Fetching` state (pulse) to indicate activity without color changes

### 2. Color Mapping

| Status | Theme Token | Visual |
|--------|-------------|--------|
| `Success` / `Idle` | `colorSuccess` | Green |
| `Fetching` | `colorPrimary` | Blue |
| `Delayed` | `colorWarning` | Yellow |
| `Error` | `colorError` | Red |
| `Paused` | `colorTextSecondary` | Gray |

### 3. Conditional Rendering

The component only renders when `refreshFrequency > 0`. This is checked via the `isRealTimeDashboard` selector, ensuring:
- No visual changes for non-real-time dashboards
- Clean UI when auto-refresh is disabled

### 4. Accessibility

- `role="status"` for screen reader announcement
- `aria-label` with human-readable status
- Tooltip provides full context
- `data-test` attributes for testing

## Dependencies

- Depends on **Task 1** (State Management) for:
  - `useRealTimeDashboard` hook
  - `AutoRefreshStatus` enum
  - Redux selectors

## Integration Notes

### With Header Component

The component integrates into the existing `titlePanelAdditionalItems` array, which already contains:
1. `PublishedStatus` component
2. `metadataBar` component

Adding `AutoRefreshStatus` maintains the existing pattern and positioning.

### With Real-Time Dashboard Hook

The component consumes state from `useRealTimeDashboard`:
```typescript
const {
  isRealTimeDashboard,  // For conditional rendering
  effectiveStatus,      // For dot color
  lastSuccessfulRefresh, // For tooltip timestamp
  lastError,            // For error tooltip
  refreshFrequency,     // For interval display
} = useRealTimeDashboard();
```

## Visual Mock

```
┌─────────────────────────────────────────────────────────┐
│  My Dashboard  ⭐  [Draft]  🟢  │   Last 7 days  │  ... │
│                          ↑                              │
│              Auto-refresh status indicator              │
│              Tooltip: "Last refreshed: 5 seconds ago"   │
│                       "Interval: 5 seconds"             │
└─────────────────────────────────────────────────────────┘
```

## Future Considerations

1. **Click Behavior:** The indicator could be clickable to open the refresh settings modal
2. **Icon Alternative:** Could show small icons instead of/alongside the dot for more explicit status
3. **Animation Options:** Could make the pulse animation configurable or add more subtle animations
