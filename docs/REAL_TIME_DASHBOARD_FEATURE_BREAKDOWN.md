# Real-Time Dashboard Auto-Refresh Optimizations

## Feature Overview

Enable a seamless near real-time dashboard experience with 5-second auto-refresh intervals and optimized UI behavior to eliminate visual disruptions during frequent data updates.

**Key Principle**: Any dashboard with an auto-refresh interval configured is considered a real-time dashboard and automatically receives these optimizations.

---

## Current Implementation Analysis

### 1. Dashboard Auto-Refresh System

**Key Files:**
- `superset-frontend/src/dashboard/components/Header/index.jsx` (lines 261-322) - Main orchestration
- `superset-frontend/src/dashboard/util/setPeriodicRunner.ts` - Timer management
- `superset-frontend/src/dashboard/actions/dashboardState.js` - Redux actions
- `superset-frontend/src/dashboard/reducers/dashboardState.js` - State management

**How It Works:**
```
User sets refresh frequency → setRefreshFrequency action dispatched
                           ↓
Redux state updates: dashboardState.refreshFrequency
                           ↓
Header useEffect detects change → startPeriodicRender() called
                           ↓
setPeriodicRunner() creates setInterval with periodicRender callback
                           ↓
Every [interval]ms: periodicRender() → fetchCharts() with staggering
                           ↓
Each chart: CHART_UPDATE_STARTED → API call → CHART_UPDATE_SUCCEEDED
```

**Current Redux State:**
```typescript
dashboardState: {
  refreshFrequency: number;           // In seconds (0 = disabled)
  shouldPersistRefreshFrequency: boolean;
  isRefreshing: boolean;
  lastRefreshTime: number;            // Timestamp
}
```

**Limitations:**
- No pause/resume capability
- No detailed status tracking (fetching, delayed, error states)
- Continues running when browser tab is inactive
- No per-chart refresh status tracking

---

### 2. Chart Loading Spinners

**Key Files:**
- `superset-frontend/src/components/Chart/Chart.tsx` (lines 279-294, 388-390) - Spinner rendering
- `superset-frontend/src/components/Chart/chartReducer.ts` - Status management
- `superset-frontend/src/components/Chart/chartAction.js` - Status actions

**How It Works:**
```typescript
chartStatus lifecycle:
'loading'  →  'success'  →  'rendered'

// Chart.tsx line 388
{isLoading ? this.renderSpinner(databaseName) : this.renderChartContainer()}
```

**Current Behavior:**
- Spinners always appear when `chartStatus === 'loading'`
- No distinction between initial load vs. auto-refresh
- No way to suppress spinners during auto-refresh

---

### 3. FiltersBadge Flickering

**Key Files:**
- `superset-frontend/src/dashboard/components/FiltersBadge/index.tsx` (lines 152-257)
- `superset-frontend/src/dashboard/components/nativeFilters/selectors.ts`

**Why Flickering Occurs:**
```typescript
// Line 152-153 - indicators shown only in certain states
const showIndicators =
  chart?.chartStatus && ['rendered', 'success'].includes(chart.chartStatus);

// When chartStatus changes to 'loading':
// 1. showIndicators becomes false
// 2. dashboardIndicators and nativeIndicators are cleared
// 3. When data arrives, indicators are rebuilt
// Result: Badge flickers from "3" → "0" → "3"
```

**Root Cause:**
- Indicators are completely cleared when chart enters loading state
- No caching/preservation of previous indicator values during refresh

---

### 4. Toast Notifications

**Key Files:**
- `superset-frontend/src/components/MessageToasts/actions.ts` - Toast actions
- `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx` (line 85)

**Current Behavior:**
```typescript
// useHeaderActionsDropdownMenu.tsx line 83-85
case MenuKeys.RefreshDashboard:
  forceRefreshAllCharts();
  addSuccessToast(t('Refreshing charts'));
  break;
```

- Toast appears on every manual refresh
- No mechanism to suppress toasts during auto-refresh
- Auto-refresh warning toast can appear when interval is set

---

### 5. Browser Tab Visibility

**Key Files:**
- `superset-frontend/src/preamble.ts` (lines 102-109) - Session validation
- `superset-frontend/src/dashboard/components/Dashboard.jsx` (lines 194-209) - Analytics logging

**Current Implementation:**
```typescript
// preamble.ts - Only validates session on tab restore
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    getMe().catch(() => {});  // Session check only
  }
});

// Dashboard.jsx - Only logs analytics, no refresh control
onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    this.visibilityEventData = { start_offset: Logger.getTimestamp(), ts: new Date().getTime() };
  } else if (document.visibilityState === 'visible') {
    this.props.actions.logEvent(LOG_ACTIONS_HIDE_BROWSER_TAB, {...});
  }
}
```

**Gap:** No pause/resume of auto-refresh based on tab visibility.

---

### 6. Chart Animations

**Key Files:**
- `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx` (line 254)
- Various chart transformProps files

**Current Behavior:**
- ECharts animations controlled per-chart type
- Some disabled (Pie, Radar, Gantt, Sankey) for performance
- Some configurable (Gauge has user checkbox)
- Default: 500ms with `cubicOut` easing

**Animation Trigger:**
```typescript
// Echart.tsx line 254
chartRef.current?.setOption(themedEchartOptions, true);  // merge=true triggers animations
```

---

### 7. Dashboard Header Structure

**Key Files:**
- `superset-frontend/src/dashboard/components/Header/index.jsx`
- `superset-frontend/packages/superset-ui-core/src/components/PageHeaderWithActions/index.tsx`
- `superset-frontend/src/dashboard/components/PublishedStatus/index.tsx` - Reference pattern

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│  TITLE PANEL          │     CENTER      │   RIGHT PANEL     │
│  - Dashboard title    │                 │   - Edit buttons  │
│  - PublishedStatus    │                 │   - Save/Discard  │
│  - MetadataBar        │                 │   - Menu dropdown │
│  - [NEW: StatusDot]   │                 │   - [NEW: Pause]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Breakdown into Tasks

### Task 1: Create Real-Time Dashboard Context & State Management

**Scope:** Create the foundational state management for real-time dashboard features.

**Current State:**
- `dashboardState.refreshFrequency` exists but lacks detailed status tracking
- No concept of "real-time mode" vs. regular mode

**Implementation Requirements:**

1. **Extend Redux State** (`superset-frontend/src/dashboard/types.ts`):
```typescript
export enum AutoRefreshStatus {
  Idle = 'idle',
  Fetching = 'fetching',
  Success = 'success',
  Delayed = 'delayed',
  Error = 'error',
  Paused = 'paused',
}

export type DashboardState = {
  // Existing fields...

  // New real-time fields
  autoRefreshStatus: AutoRefreshStatus;
  autoRefreshPaused: boolean;
  lastSuccessfulRefresh: number | null;
  lastRefreshError: string | null;
  refreshErrorCount: number;
  isAutoRefreshActive: boolean;  // Derived: refreshFrequency > 0
};
```

2. **Create New Actions** (`superset-frontend/src/dashboard/actions/dashboardState.js`):
   - `SET_AUTO_REFRESH_STATUS`
   - `SET_AUTO_REFRESH_PAUSED`
   - `SET_REFRESH_ERROR`
   - `CLEAR_REFRESH_ERROR`

3. **Create Selectors** (new file: `superset-frontend/src/dashboard/selectors/autoRefresh.ts`):
   - `selectIsRealTimeDashboard` - Returns true if refreshFrequency > 0
   - `selectAutoRefreshStatus`
   - `selectLastSuccessfulRefresh`

4. **Create Context/Hook** (new file: `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.ts`):
   - Encapsulates real-time dashboard logic
   - Provides status, pause/resume functions, manual refresh

**Files to Create:**
- `superset-frontend/src/dashboard/selectors/autoRefresh.ts`
- `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.ts`

**Files to Modify:**
- `superset-frontend/src/dashboard/types.ts`
- `superset-frontend/src/dashboard/actions/dashboardState.js`
- `superset-frontend/src/dashboard/reducers/dashboardState.js`

**Estimated Complexity:** Medium

---

### Task 2: Implement Auto-Refresh Status Indicator Component

**Scope:** Create a visual status indicator for the dashboard header showing refresh state.

**Current State:**
- No status indicator exists
- Reference pattern: `PublishedStatus` component, `AlertStatusIcon` component

**Implementation Requirements:**

1. **Create Status Indicator Component** (new directory: `superset-frontend/src/dashboard/components/AutoRefreshStatus/`):

```typescript
// States and colors (using Ant Design theme tokens)
const STATUS_CONFIG = {
  success: { color: 'colorSuccess', icon: CheckCircleOutlined, tooltip: 'Last refreshed: {timestamp}' },
  fetching: { color: 'colorPrimary', icon: SyncOutlined, tooltip: 'Fetching data...' },
  delayed: { color: 'colorWarning', icon: WarningOutlined, tooltip: 'Last refreshed: {timestamp}. Refresh delayed.' },
  error: { color: 'colorError', icon: CloseCircleOutlined, tooltip: 'Last refreshed: {timestamp}. Error: {message}' },
  paused: { color: 'colorTextSecondary', icon: PauseCircleOutlined, tooltip: 'Auto-refresh paused' },
};
```

2. **Visual Requirements:**
   - Small dot indicator (8-12px) with status color
   - Tooltip on hover showing details
   - **Critical:** No blinking/flickering between state transitions
   - Use CSS transitions for smooth color changes
   - Icon should be optional (dot is sufficient)

3. **Anti-Flicker Implementation:**
```typescript
// Use CSS transition for smooth state changes
const StatusDot = styled.div<{ status: AutoRefreshStatus }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${({ status, theme }) => STATUS_CONFIG[status].color};
  transition: background-color 300ms ease-in-out;
`;

// Debounce rapid status changes
const [displayStatus, setDisplayStatus] = useState(status);
useEffect(() => {
  const timer = setTimeout(() => setDisplayStatus(status), 100);
  return () => clearTimeout(timer);
}, [status]);
```

4. **Integration with Header** (`superset-frontend/src/dashboard/components/Header/index.jsx`):
   - Add to `titlePanelAdditionalItems` after `PublishedStatus`
   - Only render when `refreshFrequency > 0`

**Files to Create:**
- `superset-frontend/src/dashboard/components/AutoRefreshStatus/index.tsx`
- `superset-frontend/src/dashboard/components/AutoRefreshStatus/AutoRefreshStatus.test.tsx`

**Files to Modify:**
- `superset-frontend/src/dashboard/components/Header/index.jsx`

**Estimated Complexity:** Medium

---

### Task 3: Implement Pause/Resume Controls

**Scope:** Add pause/resume functionality for auto-refresh with header controls.

**Current State:**
- No pause functionality exists
- Manual refresh exists via menu dropdown

**Implementation Requirements:**

1. **Pause Icon Button in Header:**
   - Toggle button (pause/play icons)
   - Located near refresh controls
   - Tooltip: "Pause auto-refresh" / "Resume auto-refresh"

2. **Pause Behavior:**
   - Stop the setInterval timer
   - Update Redux state: `autoRefreshPaused: true`
   - Status indicator shows "paused" (white dot)
   - Preserve the refresh frequency setting

3. **Resume Behavior:**
   - Immediately fetch latest data (one-time refresh)
   - Restart the setInterval timer
   - Update Redux state: `autoRefreshPaused: false`

4. **Implementation in Header** (`index.jsx`):
```typescript
const handlePauseToggle = useCallback(() => {
  if (autoRefreshPaused) {
    // Resume: fetch immediately, then restart timer
    boundActionCreators.setAutoRefreshPaused(false);
    forceRefresh();  // Immediate refresh
    startPeriodicRender(refreshFrequency * 1000);
  } else {
    // Pause: stop timer
    boundActionCreators.setAutoRefreshPaused(true);
    stopPeriodicRender(refreshTimer.current);
  }
}, [autoRefreshPaused, refreshFrequency]);
```

5. **Manual Refresh Button Enhancement:**
   - Existing menu item triggers immediate refresh
   - Should NOT reset auto-refresh settings
   - Should NOT unpause if paused

**Files to Modify:**
- `superset-frontend/src/dashboard/components/Header/index.jsx`
- `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx`
- `superset-frontend/src/dashboard/util/setPeriodicRunner.ts` (if pause state needs to be checked)

**Estimated Complexity:** Medium

---

### Task 4: Implement Tab Visibility Auto-Pause

**Scope:** Automatically pause auto-refresh when browser tab is inactive.

**Current State:**
- Visibility change detected in `Dashboard.jsx` (for analytics only)
- Auto-refresh continues when tab is hidden (wastes resources)

**Implementation Requirements:**

1. **Extend Visibility Handler** (`Dashboard.jsx` or new hook):
```typescript
// New hook: useTabVisibility.ts
export function useTabVisibility(
  onVisible: () => void,
  onHidden: () => void
) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onVisible();
      } else {
        onHidden();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onVisible, onHidden]);
}
```

2. **Integration with Auto-Refresh:**
```typescript
// In Header component or useRealTimeDashboard hook
useTabVisibility(
  // onVisible
  () => {
    if (refreshFrequency > 0 && !manuallyPaused) {
      forceRefresh();  // Immediate refresh
      startPeriodicRender(refreshFrequency * 1000);
      setAutoRefreshStatus('fetching');
    }
  },
  // onHidden
  () => {
    if (refreshFrequency > 0) {
      stopPeriodicRender(refreshTimer.current);
      setAutoRefreshStatus('paused');
    }
  }
);
```

3. **Distinguish Manual vs Auto Pause:**
   - Track `manuallyPaused` vs `tabInactivePaused` states
   - Tab visibility should not override manual pause
   - If user manually paused, tab visibility changes should not auto-resume

4. **Status Indicator Behavior:**
   - Show "paused" state when tab is inactive
   - Open question: Should tooltip show "Auto-refresh paused (tab inactive)"?

**Files to Create:**
- `superset-frontend/src/dashboard/hooks/useTabVisibility.ts`

**Files to Modify:**
- `superset-frontend/src/dashboard/components/Header/index.jsx`
- `superset-frontend/src/dashboard/components/Dashboard.jsx` (or integrate with new hook)

**Estimated Complexity:** Medium

---

### Task 5: Implement Spinner Suppression During Auto-Refresh

**Scope:** Hide chart loading spinners during auto-refresh cycles while keeping them for initial load.

**Current State:**
- Spinners always appear when `chartStatus === 'loading'`
- No way to distinguish initial load from auto-refresh

**Implementation Requirements:**

1. **Track Refresh Context:**
   - Add `isAutoRefresh` flag to chart refresh actions
   - Store in chart state or pass via context

2. **Modify Chart Action** (`chartAction.js`):
```typescript
export function refreshChart(chartKey, force, dashboardId, isAutoRefresh = false) {
  return (dispatch, getState) => {
    // ...existing logic
    dispatch(chartUpdateStarted(chartKey, isAutoRefresh));
    // ...
  };
}

// Action includes isAutoRefresh
export function chartUpdateStarted(chartKey, isAutoRefresh = false) {
  return {
    type: CHART_UPDATE_STARTED,
    chartKey,
    isAutoRefresh,
    queryController: new AbortController(),
  };
}
```

3. **Modify Chart Reducer** (`chartReducer.ts`):
```typescript
[actions.CHART_UPDATE_STARTED](state) {
  return {
    ...state,
    chartStatus: 'loading',
    isAutoRefreshLoading: action.isAutoRefresh,  // New field
    // ...existing fields
  };
}
```

4. **Modify Chart Component** (`Chart.tsx`):
```typescript
// Line 388 - Add auto-refresh check
const showSpinner = isLoading && !chart.isAutoRefreshLoading;

{showSpinner ? this.renderSpinner(databaseName) : this.renderChartContainer()}
```

5. **Alternative Approach - Dashboard Context:**
```typescript
// Create a context that tracks dashboard-wide auto-refresh state
const AutoRefreshContext = createContext({ isAutoRefreshing: false });

// Chart component consumes context
const { isAutoRefreshing } = useContext(AutoRefreshContext);
const showSpinner = isLoading && !isAutoRefreshing;
```

**Files to Modify:**
- `superset-frontend/src/components/Chart/chartAction.js`
- `superset-frontend/src/components/Chart/chartReducer.ts`
- `superset-frontend/src/components/Chart/Chart.tsx`
- `superset-frontend/src/dashboard/actions/dashboardState.js` (for fetchCharts)
- `superset-frontend/src/explore/types.ts` (ChartState type)

**Estimated Complexity:** Medium-High

---

### Task 6: Fix FiltersBadge Flickering

**Scope:** Prevent FiltersBadge from showing transitional values (3 → 0 → 3) during refresh.

**Current State:**
- Indicators cleared when `chartStatus === 'loading'`
- Rebuilt when data arrives, causing visible flicker

**Implementation Requirements:**

1. **Preserve Previous Indicators During Loading:**
```typescript
// FiltersBadge/index.tsx

// Store previous indicators
const [stableIndicators, setStableIndicators] = useState<Indicator[]>([]);

// Only update stable indicators when we have actual data
useEffect(() => {
  if (showIndicators && indicators.length > 0) {
    setStableIndicators(indicators);
  }
  // Don't clear on loading - keep previous value
}, [showIndicators, indicators]);

// Use stableIndicators for rendering
const displayIndicators = showIndicators ? indicators : stableIndicators;
```

2. **Alternative: Skip Update During Auto-Refresh:**
```typescript
// Check if this is an auto-refresh cycle
const isAutoRefreshing = useSelector(selectIsAutoRefreshing);

const showIndicators = chart?.chartStatus &&
  (['rendered', 'success'].includes(chart.chartStatus) || isAutoRefreshing);
```

3. **Memoization Enhancement:**
```typescript
// Memoize indicator calculation to prevent unnecessary recalculations
const indicators = useMemo(() => {
  if (!showIndicators && prevIndicatorsRef.current) {
    return prevIndicatorsRef.current;  // Return cached during loading
  }
  const newIndicators = calculateIndicators();
  prevIndicatorsRef.current = newIndicators;
  return newIndicators;
}, [dependencies]);
```

4. **CSS Transition for Smooth Updates:**
```typescript
// Add transition to badge count
const BadgeCount = styled.span`
  transition: opacity 150ms ease-in-out;
`;
```

**Files to Modify:**
- `superset-frontend/src/dashboard/components/FiltersBadge/index.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/selectors.ts` (caching improvements)

**Estimated Complexity:** Medium

---

### Task 7: Suppress Auto-Refresh Toast Notifications

**Scope:** Suppress toast notifications during auto-refresh while keeping them for manual actions.

**Current State:**
- Toast appears on manual refresh: "Refreshing charts"
- No differentiation between manual and auto-refresh

**Implementation Requirements:**

1. **Modify Refresh Flow:**
   - Auto-refresh (from timer) should NOT trigger toasts
   - Manual refresh (from menu) should keep toast behavior
   - Status indicator replaces toast feedback for auto-refresh

2. **Implementation Approach:**
```typescript
// In Header component - periodicRender callback (auto-refresh)
const periodicRender = () => {
  // NO toast here - auto-refresh is silent
  const fetchCharts = (charts, force = false) =>
    boundActionCreators.fetchCharts(charts, force, interval * 0.2, dashboardInfo.id);

  // Update status indicator instead
  boundActionCreators.setAutoRefreshStatus('fetching');

  return fetchCharts(affectedCharts, true)
    .then(() => boundActionCreators.setAutoRefreshStatus('success'))
    .catch(() => boundActionCreators.setAutoRefreshStatus('error'));
};

// In useHeaderActionsDropdownMenu.tsx - manual refresh
case MenuKeys.RefreshDashboard:
  forceRefreshAllCharts();
  addSuccessToast(t('Refreshing charts'));  // Keep toast for manual
  break;
```

3. **Consider Removing Warning Toast:**
   - Current behavior shows warning when auto-refresh interval is very low
   - May want to suppress this for real-time dashboards or make it one-time

**Files to Modify:**
- `superset-frontend/src/dashboard/components/Header/index.jsx`
- `superset-frontend/src/dashboard/components/Header/useHeaderActionsDropdownMenu.tsx` (if needed)

**Estimated Complexity:** Low

---

### Task 8: Reduce/Disable Chart Animations During Auto-Refresh

**Scope:** Minimize or remove chart animations during auto-refresh to reduce visual disruption.

**Current State:**
- ECharts animations controlled per-chart type
- Default 500ms animations with easing
- Some charts already disable animations

**Implementation Requirements:**

1. **Pass Animation Flag Through Props:**
```typescript
// In chart transformProps functions
export default function transformProps(chartProps: ChartProps) {
  const { isAutoRefresh } = chartProps;

  return {
    echartOptions: {
      animation: !isAutoRefresh,  // Disable during auto-refresh
      animationDuration: isAutoRefresh ? 0 : 500,
      // ...rest of options
    },
  };
}
```

2. **Modify Echart Component:**
```typescript
// Echart.tsx
interface EchartProps {
  // ...existing props
  disableAnimation?: boolean;
}

// In setOption call
const options = disableAnimation
  ? { ...themedEchartOptions, animation: false }
  : themedEchartOptions;
chartRef.current?.setOption(options, true);
```

3. **Dashboard-Level Configuration:**
```typescript
// Pass isAutoRefreshing to all charts via context or props
<Chart
  {...props}
  isAutoRefresh={isAutoRefreshing}
/>
```

4. **Charts to Update:**
   - Gauge (has explicit animation control)
   - Tree (500ms default)
   - Graph (layout animation)
   - Timeseries charts
   - Bar/Line/Area charts

**Files to Modify:**
- `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx`
- Various `transformProps.ts` files in chart plugins
- `superset-frontend/src/dashboard/components/gridComponents/ChartHolder/ChartHolder.tsx`

**Estimated Complexity:** Medium-High (touches many chart plugins)

---

### Task 9: Add 5-Second Refresh Interval Option

**Scope:** Enable 5-second refresh intervals (below current 10-second minimum).

**Current State:**
- Minimum refresh interval: 10 seconds (enforced in `RefreshFrequencySelect.tsx`)
- Options defined in `REFRESH_FREQUENCY_OPTIONS`

**Implementation Requirements:**

1. **Modify Refresh Options:**
```typescript
// RefreshFrequencySelect.tsx
export const MINIMUM_REFRESH_INTERVAL = 5;  // Changed from 10

export const REFRESH_FREQUENCY_OPTIONS = [
  { value: 0, label: "Don't refresh" },
  { value: 5, label: "5 seconds" },   // NEW
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  // ...rest
];
```

2. **Backend Configuration Check:**
```python
# superset/config.py - ensure backend allows 5 seconds
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [0, "Don't refresh"],
    [5, "5 seconds"],
    [10, "10 seconds"],
    # ...
]

# May need to adjust this if it blocks short intervals
SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT = 0
```

3. **Validation Update:**
   - Update any validation that enforces minimum 10 seconds
   - Consider adding warning for very short intervals

**Files to Modify:**
- `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.tsx`
- `superset/config.py` (backend configuration)

**Estimated Complexity:** Low

---

### Task 10: Comprehensive Testing & Integration

**Scope:** Write tests and ensure all components work together seamlessly.

**Test Categories:**

1. **Unit Tests:**
   - `useRealTimeDashboard` hook
   - `AutoRefreshStatus` component
   - Selectors
   - Reducer changes

2. **Integration Tests:**
   - Header with status indicator
   - Pause/resume flow
   - Tab visibility handling
   - Spinner suppression

3. **E2E Tests (Playwright):**
   - Configure 5-second refresh
   - Verify no spinners during refresh
   - Verify status indicator state changes
   - Verify pause/resume
   - Verify tab visibility pause

**Test Scenarios:**
```typescript
test('status indicator shows correct states during refresh cycle', async () => {
  // Setup dashboard with 5-second refresh
  // Verify: green (success) → blue (fetching) → green (success)
  // Verify: no flickering between states
});

test('spinner is suppressed during auto-refresh', async () => {
  // Setup dashboard with auto-refresh
  // Trigger refresh cycle
  // Verify: no loading spinners appear
});

test('FiltersBadge does not flicker during refresh', async () => {
  // Setup dashboard with filters
  // Trigger refresh
  // Verify: badge count remains stable (no 3→0→3)
});

test('auto-refresh pauses when tab is hidden', async () => {
  // Setup dashboard with auto-refresh
  // Simulate tab becoming hidden
  // Verify: refresh timer stops, status shows paused
  // Simulate tab becoming visible
  // Verify: immediate refresh, timer resumes
});
```

**Files to Create:**
- `superset-frontend/src/dashboard/components/AutoRefreshStatus/AutoRefreshStatus.test.tsx`
- `superset-frontend/src/dashboard/hooks/useRealTimeDashboard.test.ts`
- `superset-frontend/src/dashboard/selectors/autoRefresh.test.ts`
- E2E tests in Playwright test directory

**Estimated Complexity:** Medium-High

---

## Implementation Order (Recommended)

```
Phase 1: Foundation
├── Task 1: State Management (Required First)
├── Task 9: Add 5-Second Option (Quick Win)
└── Task 7: Suppress Toasts (Quick Win)

Phase 2: Core Features
├── Task 2: Status Indicator Component
├── Task 3: Pause/Resume Controls
└── Task 4: Tab Visibility Auto-Pause

Phase 3: Visual Optimizations
├── Task 5: Spinner Suppression
├── Task 6: FiltersBadge Fix
└── Task 8: Animation Reduction

Phase 4: Quality Assurance
└── Task 10: Testing & Integration
```

---

## Open Design Questions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Should status indicator show icon or just colored dot? | Dot only - simpler, less visual noise |
| 2 | Delayed state threshold: after how many missed refreshes? | Yellow after 1 miss, Red after 3+ |
| 3 | Should auto-pause on inactive tab be configurable? | Always on - saves resources |
| 4 | Should manual refresh unpause auto-refresh? | No - keep them independent |
| 5 | Status indicator tooltip format? | "Last updated: 2:34:15 PM" or relative "5 seconds ago"? |

---

## Future Considerations

### Time-Series Ticker Behavior (Nice-to-Have)

For time-series charts, explore appending new data points to the right side (ticker-style) rather than re-rendering the entire visualization.

**Challenges:**
- Requires chart-level data management
- Need to track which points are "new" vs "existing"
- X-axis would need to shift
- Performance implications for long-running dashboards

**Recommendation:** Defer to Phase 2 after core features are stable.

---

## Dependencies & Risks

### Dependencies:
- Ant Design theme tokens for status colors
- ECharts animation API
- Redux state management patterns
- Page Visibility API (browser support: 98%+)

### Risks:
1. **Performance:** Very short refresh intervals (5s) may stress server
   - Mitigation: Staggered refresh, server-side caching

2. **State Complexity:** Adding many new state fields
   - Mitigation: Clean abstractions via hooks/selectors

3. **Chart Plugin Updates:** Many plugins need animation changes
   - Mitigation: Create shared utility, apply incrementally

4. **Testing Complexity:** Timing-dependent tests are flaky
   - Mitigation: Use jest fake timers, robust waiting strategies
