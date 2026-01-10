# Task 10: Comprehensive Testing & Integration

## Overview

This task covers the integration testing of all real-time dashboard features (Tasks 1-9) and ensures they work together seamlessly. It includes unit tests, integration tests, and end-to-end test scenarios.

## Test Categories

### 1. Unit Tests

Individual component tests for each feature.

### 2. Integration Tests

Tests that verify multiple features working together.

### 3. End-to-End Tests

Full user workflow tests using Playwright.

## Test Plan by Feature

### Task 1: State Management Tests

**Location:** `superset-frontend/src/dashboard/actions/dashboardState.test.ts`

```typescript
import { dashboardStateReducer } from '../reducers/dashboardState';
import {
  setAutoRefreshStatus,
  setAutoRefreshIsPaused,
  recordAutoRefreshSuccess,
  recordAutoRefreshError,
  clearAutoRefreshError,
  AutoRefreshStatus,
} from '../actions/dashboardState';

test('setAutoRefreshStatus updates status correctly', () => {
  const initialState = {
    autoRefreshStatus: AutoRefreshStatus.Idle,
  };

  const newState = dashboardStateReducer(
    initialState,
    setAutoRefreshStatus(AutoRefreshStatus.Fetching),
  );

  expect(newState.autoRefreshStatus).toBe(AutoRefreshStatus.Fetching);
});

test('recordAutoRefreshSuccess records timestamp and clears error', () => {
  const initialState = {
    lastAutoRefreshSuccessTime: null,
    autoRefreshError: 'Previous error',
  };

  const now = Date.now();
  const newState = dashboardStateReducer(
    initialState,
    recordAutoRefreshSuccess(),
  );

  expect(newState.lastAutoRefreshSuccessTime).toBeGreaterThanOrEqual(now);
  expect(newState.autoRefreshError).toBeNull();
});

test('recordAutoRefreshError records error message', () => {
  const initialState = {
    autoRefreshError: null,
  };

  const newState = dashboardStateReducer(
    initialState,
    recordAutoRefreshError('Network timeout'),
  );

  expect(newState.autoRefreshError).toBe('Network timeout');
});

test('setAutoRefreshIsPaused toggles pause state', () => {
  const initialState = {
    autoRefreshIsPaused: false,
  };

  const pausedState = dashboardStateReducer(
    initialState,
    setAutoRefreshIsPaused(true),
  );

  expect(pausedState.autoRefreshIsPaused).toBe(true);

  const resumedState = dashboardStateReducer(
    pausedState,
    setAutoRefreshIsPaused(false),
  );

  expect(resumedState.autoRefreshIsPaused).toBe(false);
});
```

### Task 2: Status Indicator Tests

**Location:** `superset-frontend/src/dashboard/components/AutoRefreshStatusIndicator/AutoRefreshStatusIndicator.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import AutoRefreshStatusIndicator from './AutoRefreshStatusIndicator';
import { AutoRefreshStatus } from '../../types';

const mockStore = configureStore([]);

test('renders nothing when refresh frequency is 0', () => {
  const store = mockStore({
    dashboardState: {
      refreshFrequency: 0,
    },
  });

  const { container } = render(
    <Provider store={store}>
      <AutoRefreshStatusIndicator />
    </Provider>,
  );

  expect(container.firstChild).toBeNull();
});

test('displays green dot when status is Idle', () => {
  const store = mockStore({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Idle,
      autoRefreshIsPaused: false,
      autoRefreshError: null,
    },
  });

  render(
    <Provider store={store}>
      <AutoRefreshStatusIndicator />
    </Provider>,
  );

  const dot = screen.getByTestId('auto-refresh-status-dot');
  expect(dot).toHaveStyle({ backgroundColor: expect.stringContaining('green') });
});

test('displays blue dot when status is Fetching', () => {
  const store = mockStore({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Fetching,
      autoRefreshIsPaused: false,
    },
  });

  render(
    <Provider store={store}>
      <AutoRefreshStatusIndicator />
    </Provider>,
  );

  const dot = screen.getByTestId('auto-refresh-status-dot');
  expect(dot).toHaveStyle({ backgroundColor: expect.stringContaining('blue') });
});

test('displays yellow dot when paused', () => {
  const store = mockStore({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Idle,
      autoRefreshIsPaused: true,
    },
  });

  render(
    <Provider store={store}>
      <AutoRefreshStatusIndicator />
    </Provider>,
  );

  const dot = screen.getByTestId('auto-refresh-status-dot');
  expect(dot).toHaveStyle({ backgroundColor: expect.stringContaining('yellow') });
});

test('displays red dot when there is an error', () => {
  const store = mockStore({
    dashboardState: {
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Idle,
      autoRefreshError: 'Network error',
    },
  });

  render(
    <Provider store={store}>
      <AutoRefreshStatusIndicator />
    </Provider>,
  );

  const dot = screen.getByTestId('auto-refresh-status-dot');
  expect(dot).toHaveStyle({ backgroundColor: expect.stringContaining('red') });
});
```

### Task 3: Pause/Resume Tests

**Location:** `superset-frontend/src/dashboard/components/Header/Header.test.tsx`

Add to existing test file:

```typescript
test('pause button stops auto-refresh timer', async () => {
  const { getByTestId } = renderDashboardHeader({
    refreshFrequency: 5,
    autoRefreshIsPaused: false,
  });

  const pauseButton = getByTestId('auto-refresh-pause-button');
  fireEvent.click(pauseButton);

  expect(mockSetAutoRefreshIsPaused).toHaveBeenCalledWith(true);
});

test('resume button restarts auto-refresh timer', async () => {
  const { getByTestId } = renderDashboardHeader({
    refreshFrequency: 5,
    autoRefreshIsPaused: true,
  });

  const resumeButton = getByTestId('auto-refresh-resume-button');
  fireEvent.click(resumeButton);

  expect(mockSetAutoRefreshIsPaused).toHaveBeenCalledWith(false);
});
```

### Task 4: Tab Visibility Tests

**Location:** `superset-frontend/src/dashboard/components/Header/tabVisibility.test.tsx`

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useTabVisibilityAutoRefreshPause } from './useTabVisibilityAutoRefreshPause';

test('pauses refresh when tab becomes hidden', () => {
  const setAutoRefreshIsPaused = jest.fn();

  renderHook(() =>
    useTabVisibilityAutoRefreshPause({
      refreshFrequency: 5,
      setAutoRefreshIsPaused,
    }),
  );

  // Simulate tab becoming hidden
  Object.defineProperty(document, 'visibilityState', {
    value: 'hidden',
    writable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));

  expect(setAutoRefreshIsPaused).toHaveBeenCalledWith(true);
});

test('resumes refresh when tab becomes visible', () => {
  const setAutoRefreshIsPaused = jest.fn();

  renderHook(() =>
    useTabVisibilityAutoRefreshPause({
      refreshFrequency: 5,
      setAutoRefreshIsPaused,
      isPaused: true,
      wasPausedByVisibility: true,
    }),
  );

  // Simulate tab becoming visible
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));

  expect(setAutoRefreshIsPaused).toHaveBeenCalledWith(false);
});

test('does not auto-resume if manually paused', () => {
  const setAutoRefreshIsPaused = jest.fn();

  renderHook(() =>
    useTabVisibilityAutoRefreshPause({
      refreshFrequency: 5,
      setAutoRefreshIsPaused,
      isPaused: true,
      wasPausedByVisibility: false, // Manually paused
    }),
  );

  // Simulate tab becoming visible
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));

  // Should NOT resume
  expect(setAutoRefreshIsPaused).not.toHaveBeenCalled();
});
```

### Task 5: Spinner Suppression Tests

**Location:** `superset-frontend/src/dashboard/contexts/AutoRefreshContext.test.tsx`

```typescript
import { render, screen, act, renderHook } from '@testing-library/react';
import {
  AutoRefreshProvider,
  useAutoRefreshContext,
  useIsAutoRefreshing,
} from './AutoRefreshContext';

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
```

### Task 6: FiltersBadge Flickering Tests

Tests added in the FiltersBadge section of Task 6.

### Task 7: Toast Suppression Tests

**Location:** `superset-frontend/src/dashboard/components/Header/Header.test.tsx`

```typescript
test('does not show toast during auto-refresh', async () => {
  jest.useFakeTimers();

  const { rerender } = renderDashboardHeader({
    refreshFrequency: 5,
  });

  // Advance timer to trigger auto-refresh
  act(() => {
    jest.advanceTimersByTime(5000);
  });

  // Toast should NOT be called
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  jest.useRealTimers();
});
```

### Task 8: Animation Reduction Tests

**Location:** `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.test.tsx`

```typescript
import { render } from '@testing-library/react';
import { ThemeProvider } from '@apache-superset/core/ui';
import { supersetTheme } from '@apache-superset/core/ui';
import Echart from './Echart';

test('applies animation: false when isRefreshing is true', () => {
  // Mock echarts init and setOption
  const mockSetOption = jest.fn();
  jest.mock('echarts/core', () => ({
    init: () => ({
      setOption: mockSetOption,
      resize: jest.fn(),
      dispose: jest.fn(),
    }),
  }));

  render(
    <ThemeProvider theme={supersetTheme}>
      <Echart
        width={400}
        height={300}
        echartOptions={{ series: [{ type: 'line' }] }}
        isRefreshing={true}
      />
    </ThemeProvider>,
  );

  // Verify setOption was called with animation: false
  expect(mockSetOption).toHaveBeenCalledWith(
    expect.objectContaining({
      animation: false,
    }),
    true,
  );
});
```

### Task 9: 5-Second Interval Tests

**Location:** `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import {
  RefreshFrequencySelect,
  MINIMUM_REFRESH_INTERVAL,
  getRefreshWarningMessage,
} from './RefreshFrequencySelect';

test('includes 5-second option in frequency list', () => {
  render(<RefreshFrequencySelect value={0} onChange={jest.fn()} />);

  expect(screen.getByText('5 seconds')).toBeInTheDocument();
});

test('allows selection of 5-second interval', () => {
  const onChange = jest.fn();
  render(<RefreshFrequencySelect value={0} onChange={onChange} />);

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

test('custom input rejects values below 5', () => {
  const onChange = jest.fn();
  render(<RefreshFrequencySelect value={-1} onChange={onChange} />);

  const customInput = screen.getByPlaceholderText('5+');
  fireEvent.change(customInput, { target: { value: '3' } });

  // onChange should not be called for values below minimum
  expect(onChange).not.toHaveBeenCalled();
});
```

## Integration Tests

### Full Auto-Refresh Cycle Test

**Location:** `superset-frontend/src/dashboard/integration-tests/autoRefreshCycle.test.tsx`

```typescript
import { render, screen, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from '@reduxjs/toolkit';
import Dashboard from '../containers/DashboardPage';

jest.useFakeTimers();

test('complete auto-refresh cycle works correctly', async () => {
  const store = configureStore({
    // ... store configuration with mock state
  });

  render(
    <Provider store={store}>
      <Dashboard dashboardId={1} />
    </Provider>,
  );

  // 1. Verify status indicator shows green (Idle)
  expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('idle');

  // 2. Enable 5-second refresh
  const refreshModal = screen.getByText('Set auto-refresh');
  fireEvent.click(refreshModal);
  fireEvent.click(screen.getByText('5 seconds'));
  fireEvent.click(screen.getByText('Save'));

  // 3. Advance time to trigger refresh
  act(() => {
    jest.advanceTimersByTime(5000);
  });

  // 4. Verify status shows blue (Fetching)
  await waitFor(() => {
    expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('fetching');
  });

  // 5. Verify spinners are suppressed
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

  // 6. Verify no toast is shown
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  // 7. Wait for fetch to complete
  await waitFor(() => {
    expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('idle');
  });

  // 8. Verify charts updated without animation flash
  // (This would require mocking ECharts)
});

test('pause/resume cycle works correctly', async () => {
  const store = configureStore({
    // ... with refreshFrequency: 5
  });

  render(
    <Provider store={store}>
      <Dashboard dashboardId={1} />
    </Provider>,
  );

  // 1. Pause auto-refresh
  fireEvent.click(screen.getByTestId('auto-refresh-pause-button'));

  // 2. Verify status shows yellow (Paused)
  expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('paused');

  // 3. Advance time - no refresh should happen
  const initialRefreshCount = mockFetchCharts.mock.calls.length;
  act(() => {
    jest.advanceTimersByTime(10000);
  });
  expect(mockFetchCharts.mock.calls.length).toBe(initialRefreshCount);

  // 4. Resume auto-refresh
  fireEvent.click(screen.getByTestId('auto-refresh-resume-button'));

  // 5. Verify status shows green (Idle)
  expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('idle');

  // 6. Advance time - refresh should happen
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(mockFetchCharts.mock.calls.length).toBe(initialRefreshCount + 1);
});

test('tab visibility auto-pause works correctly', async () => {
  const store = configureStore({
    // ... with refreshFrequency: 5
  });

  render(
    <Provider store={store}>
      <Dashboard dashboardId={1} />
    </Provider>,
  );

  // 1. Simulate tab becoming hidden
  Object.defineProperty(document, 'visibilityState', {
    value: 'hidden',
    writable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));

  // 2. Verify auto-paused
  expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('paused');

  // 3. Advance time - no refresh
  const initialRefreshCount = mockFetchCharts.mock.calls.length;
  act(() => {
    jest.advanceTimersByTime(10000);
  });
  expect(mockFetchCharts.mock.calls.length).toBe(initialRefreshCount);

  // 4. Simulate tab becoming visible
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    writable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));

  // 5. Verify auto-resumed
  expect(screen.getByTestId('auto-refresh-status-dot')).toHaveClass('idle');
});
```

## End-to-End Tests (Playwright)

**Location:** `superset-frontend/playwright/tests/dashboard-auto-refresh.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard Auto-Refresh', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin');
    await page.click('button[type="submit"]');
    await page.goto('/superset/dashboard/1/');
    await page.waitForLoadState('networkidle');
  });

  test('can enable 5-second auto-refresh', async ({ page }) => {
    // Open actions menu
    await page.click('[data-test="header-actions-trigger"]');

    // Click "Set auto-refresh"
    await page.click('text=Set auto-refresh');

    // Select 5 seconds option
    await page.click('text=5 seconds');

    // Verify warning is displayed
    await expect(page.locator('text=impact server performance')).toBeVisible();

    // Save
    await page.click('text=Save for this session');

    // Verify status indicator appears
    await expect(page.locator('[data-test="auto-refresh-status-dot"]')).toBeVisible();
  });

  test('status indicator changes color during refresh cycle', async ({ page }) => {
    // Enable 5-second refresh
    await page.click('[data-test="header-actions-trigger"]');
    await page.click('text=Set auto-refresh');
    await page.click('text=5 seconds');
    await page.click('text=Save for this session');

    // Wait for refresh to start
    await page.waitForTimeout(5500);

    // Check status indicator is blue (fetching)
    const dot = page.locator('[data-test="auto-refresh-status-dot"]');
    await expect(dot).toHaveClass(/fetching/);

    // Wait for refresh to complete
    await page.waitForTimeout(2000);

    // Check status indicator is green (idle)
    await expect(dot).toHaveClass(/idle/);
  });

  test('pause button stops auto-refresh', async ({ page }) => {
    // Enable auto-refresh
    await page.click('[data-test="header-actions-trigger"]');
    await page.click('text=Set auto-refresh');
    await page.click('text=5 seconds');
    await page.click('text=Save for this session');

    // Click pause button
    await page.click('[data-test="auto-refresh-pause-button"]');

    // Verify status shows paused (yellow)
    const dot = page.locator('[data-test="auto-refresh-status-dot"]');
    await expect(dot).toHaveClass(/paused/);

    // Wait and verify no network requests
    const requestCount = { count: 0 };
    page.on('request', () => requestCount.count++);

    await page.waitForTimeout(10000);

    // Only minimal requests should occur (not chart data requests)
    expect(requestCount.count).toBeLessThan(5);
  });

  test('spinners are not shown during auto-refresh', async ({ page }) => {
    // Enable auto-refresh
    await page.click('[data-test="header-actions-trigger"]');
    await page.click('text=Set auto-refresh');
    await page.click('text=5 seconds');
    await page.click('text=Save for this session');

    // Wait for refresh to start
    await page.waitForTimeout(5500);

    // Verify no loading spinners visible
    await expect(page.locator('.loading-spinner')).not.toBeVisible();
  });

  test('no toast notifications during auto-refresh', async ({ page }) => {
    // Enable auto-refresh
    await page.click('[data-test="header-actions-trigger"]');
    await page.click('text=Set auto-refresh');
    await page.click('text=5 seconds');
    await page.click('text=Save for this session');

    // Wait through multiple refresh cycles
    await page.waitForTimeout(12000);

    // Verify no toast notifications
    await expect(page.locator('.ant-message')).not.toBeVisible();
  });

  test('tab visibility pauses and resumes refresh', async ({ page, context }) => {
    // Enable auto-refresh
    await page.click('[data-test="header-actions-trigger"]');
    await page.click('text=Set auto-refresh');
    await page.click('text=5 seconds');
    await page.click('text=Save for this session');

    // Open new tab to make current tab hidden
    const newPage = await context.newPage();
    await newPage.goto('https://example.com');

    // Wait a bit
    await page.waitForTimeout(1000);

    // Check status shows paused (would need to verify via API)

    // Return to dashboard tab
    await page.bringToFront();

    // Verify status shows active
    const dot = page.locator('[data-test="auto-refresh-status-dot"]');
    await expect(dot).not.toHaveClass(/paused/);
  });
});
```

## Test Data Setup

### Mock Store Factory

**Location:** `superset-frontend/spec/fixtures/mockAutoRefreshState.ts`

```typescript
import { AutoRefreshStatus } from '../../src/dashboard/types';

export const createMockAutoRefreshState = (overrides = {}) => ({
  dashboardState: {
    refreshFrequency: 5,
    autoRefreshStatus: AutoRefreshStatus.Idle,
    autoRefreshIsPaused: false,
    autoRefreshError: null,
    lastAutoRefreshSuccessTime: null,
    ...overrides,
  },
});

export const mockAutoRefreshChartState = {
  charts: {
    1: {
      id: 1,
      chartStatus: 'rendered',
      queriesResponse: [{ status: 'success' }],
    },
    2: {
      id: 2,
      chartStatus: 'rendered',
      queriesResponse: [{ status: 'success' }],
    },
  },
};
```

## File Summary

### Test Files to Create

| File | Purpose |
|------|---------|
| `superset-frontend/src/dashboard/actions/dashboardState.test.ts` | State management tests |
| `superset-frontend/src/dashboard/components/AutoRefreshStatusIndicator/AutoRefreshStatusIndicator.test.tsx` | Status indicator tests |
| `superset-frontend/src/dashboard/contexts/AutoRefreshContext.test.tsx` | Context tests |
| `superset-frontend/src/dashboard/integration-tests/autoRefreshCycle.test.tsx` | Integration tests |
| `superset-frontend/playwright/tests/dashboard-auto-refresh.spec.ts` | E2E tests |
| `superset-frontend/spec/fixtures/mockAutoRefreshState.ts` | Test fixtures |

### Existing Test Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/src/dashboard/components/Header/Header.test.tsx` | Add pause/resume, toast suppression tests |
| `superset-frontend/src/dashboard/components/FiltersBadge/FiltersBadge.test.tsx` | Add flickering prevention tests |
| `superset-frontend/src/dashboard/components/RefreshFrequency/RefreshFrequencySelect.test.tsx` | Add 5-second interval tests |
| `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.test.tsx` | Add animation suppression tests |

## Running Tests

### Unit Tests

```bash
# Run all dashboard tests
npm run test -- --testPathPattern=dashboard

# Run specific test file
npm run test -- src/dashboard/actions/dashboardState.test.ts

# Run with coverage
npm run test -- --coverage --testPathPattern=dashboard
```

### Integration Tests

```bash
# Run integration tests
npm run test -- --testPathPattern=integration-tests
```

### E2E Tests

```bash
# Run Playwright tests
npm run playwright:test -- dashboard-auto-refresh.spec.ts

# Run in headed mode
npm run playwright:headed -- dashboard-auto-refresh.spec.ts

# Debug mode
npm run playwright:debug -- dashboard-auto-refresh.spec.ts
```

## Test Coverage Goals

| Area | Coverage Target |
|------|-----------------|
| State Management (Task 1) | 100% |
| Status Indicator (Task 2) | 95% |
| Pause/Resume (Task 3) | 95% |
| Tab Visibility (Task 4) | 90% |
| Spinner Suppression (Task 5) | 90% |
| FiltersBadge Fix (Task 6) | 85% |
| Toast Suppression (Task 7) | 90% |
| Animation Reduction (Task 8) | 80% |
| 5-Second Option (Task 9) | 95% |

## Manual Testing Checklist

### Pre-Release Testing

- [ ] Enable 5-second refresh on a dashboard with multiple charts
- [ ] Verify status indicator shows correct colors
- [ ] Test pause/resume button functionality
- [ ] Switch tabs and verify auto-pause/resume
- [ ] Verify no spinners during auto-refresh
- [ ] Verify FiltersBadge doesn't flicker
- [ ] Verify no toast notifications
- [ ] Verify charts update without visible animations
- [ ] Test error state by simulating network failure
- [ ] Test with different chart types (ECharts, Table, etc.)
- [ ] Test on slow network connection
- [ ] Test with large dashboards (10+ charts)
- [ ] Test memory usage over extended period (30+ minutes)
- [ ] Test CPU usage during auto-refresh

### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile/Responsive

- [ ] Status indicator visible on mobile
- [ ] Pause/resume accessible on mobile
- [ ] Tab visibility works on mobile browsers
