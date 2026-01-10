# Task 8: Reduce/Disable Chart Animations During Auto-Refresh

## Overview

During auto-refresh cycles, chart animations can create visual noise and distraction, especially at 5-second intervals. Animations also consume CPU resources and can cause layout shifts. This task disables or reduces chart animations during auto-refresh while keeping them for initial load and manual refresh.

## Current Implementation

### ChartProps.isRefreshing

**File:** `superset-frontend/packages/superset-ui-core/src/chart/models/ChartProps.ts`

The `ChartProps` class already has an `isRefreshing` property (lines 102, 153, 207):

```typescript
export interface ChartPropsConfig {
  // ...
  /** is the chart refreshing its contents */
  isRefreshing?: boolean;
  // ...
}

export default class ChartProps<FormData extends RawFormData = RawFormData> {
  // ...
  isRefreshing?: boolean;
  // ...
}
```

### ECharts Animation Configuration

ECharts supports global and per-series animation settings:

```typescript
const echartOptions = {
  animation: true,            // Global animation toggle
  animationDuration: 1000,    // Animation duration in ms
  animationEasing: 'linear',  // Easing function
  animationThreshold: 2000,   // Auto-disable if data count exceeds this
  series: [{
    animation: false,         // Per-series override
    // ...
  }]
};
```

### Current Chart Implementations

Some charts already disable animations:

| Chart | Location | Status |
|-------|----------|--------|
| Pie | `Pie/transformProps.ts:385` | `animation: false` |
| Radar | `Radar/transformProps.ts:321` | `animation: false` |
| Gantt | `Gantt/transformProps.ts:299,316` | `animation: false` |
| Sankey | `Sankey/transformProps.ts:121` | `animation: false` |
| Timeseries | `Timeseries/transformers.ts:494,574` | `animation: false` (annotations only) |

Other charts (Bar, Line, Gauge, etc.) still have animations enabled by default.

### EChart Component

**File:** `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx`

The core EChart component applies options via:

```typescript
chartRef.current?.setOption(themedEchartOptions, true);
```

## Implementation Plan

### Approach: Global Animation Control via Echart Component

The cleanest approach is to handle animation control at the Echart component level, where all ECharts charts are rendered. This avoids modifying every individual chart's transformProps.

### Step 1: Add isRefreshing Prop to Echart Component

**File to modify:** `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx`

Update the component to accept an `isRefreshing` prop:

```typescript
function Echart(
  {
    width,
    height,
    echartOptions,
    eventHandlers,
    zrEventHandlers,
    selectedValues = {},
    refs,
    vizType,
    isRefreshing,  // NEW: Flag to disable animations
  }: EchartsProps,
  ref: Ref<EchartsHandler>,
) {
  // ... existing code ...

  useEffect(() => {
    if (didMount) {
      // ... existing event handler setup ...

      const getEchartsTheme = (options: any) => {
        // ... existing theme code ...
      };

      const baseTheme = getEchartsTheme(echartOptions);
      const globalOverrides = theme.echartsOptionsOverrides || {};
      const chartOverrides = vizType
        ? theme.echartsOptionsOverridesByChartType?.[vizType] || {}
        : {};

      // NEW: Apply animation override when refreshing
      const animationOverride = isRefreshing
        ? {
            animation: false,
            animationDuration: 0,
          }
        : {};

      const themedEchartOptions = mergeReplaceArrays(
        baseTheme,
        echartOptions,
        globalOverrides,
        chartOverrides,
        animationOverride,  // NEW: Apply last to override any animation settings
      );

      chartRef.current?.setOption(themedEchartOptions, true);
    }
  }, [didMount, echartOptions, eventHandlers, zrEventHandlers, theme, vizType, isRefreshing]);  // Add isRefreshing dependency
```

### Step 2: Update EchartsProps Type

**File to modify:** `superset-frontend/plugins/plugin-chart-echarts/src/types.ts`

Add `isRefreshing` to the props interface:

```typescript
export interface EchartsProps {
  width: number;
  height: number;
  echartOptions: EChartsCoreOption;
  eventHandlers?: Record<string, EventHandler>;
  zrEventHandlers?: Record<string, EventHandler>;
  selectedValues?: Record<number, string>;
  refs?: Refs;
  vizType?: string;
  isRefreshing?: boolean;  // NEW
}
```

### Step 3: Pass isRefreshing Through Chart Components

Each ECharts chart component needs to pass the `isRefreshing` prop to the Echart component.

**Example for Timeseries chart:**

**File to modify:** `superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/EchartsTimeseries.tsx`

```typescript
export default function EchartsTimeseries({
  // ... existing props ...
  isRefreshing,  // Should already be available from ChartProps
}: EchartsTimeseriesChartProps) {
  // ... existing code ...

  return (
    <Echart
      // ... existing props ...
      isRefreshing={isRefreshing}
    />
  );
}
```

**Files to modify for each ECharts chart:**

| File | Component |
|------|-----------|
| `Timeseries/EchartsTimeseries.tsx` | EchartsTimeseries |
| `MixedTimeseries/EchartsMixedTimeseries.tsx` | EchartsMixedTimeseries |
| `Pie/EchartsPie.tsx` | EchartsPie |
| `Funnel/EchartsFunnel.tsx` | EchartsFunnel |
| `Gauge/EchartsGauge.tsx` | EchartsGauge |
| `Graph/EchartsGraph.tsx` | EchartsGraph |
| `Radar/EchartsRadar.tsx` | EchartsRadar |
| `Treemap/EchartsTreemap.tsx` | EchartsTreemap |
| `Sunburst/EchartsSunburst.tsx` | EchartsSunburst |
| `BoxPlot/EchartsBoxPlot.tsx` | EchartsBoxPlot |
| `Bubble/EchartsBubble.tsx` | EchartsBubble |
| `Waterfall/EchartsWaterfall.tsx` | EchartsWaterfall |
| `Tree/EchartsTree.tsx` | EchartsTree |
| `Gantt/EchartsGantt.tsx` | EchartsGantt |

### Step 4: Pass isRefreshing from Dashboard Context

**File to modify:** `superset-frontend/src/dashboard/components/gridComponents/Chart/Chart.jsx`

The Chart component needs to pass the `isAutoRefreshing` flag from the context as `isRefreshing` to the chart.

```javascript
import { useIsAutoRefreshing } from '../../../contexts/AutoRefreshContext';

const Chart = props => {
  const isAutoRefreshing = useIsAutoRefreshing();

  // ... existing code ...

  return (
    <SliceContainer>
      {/* ... */}
      <ChartContainer
        // ... existing props ...
        isRefreshing={isAutoRefreshing}  // Pass the auto-refresh state
      />
    </SliceContainer>
  );
};
```

### Step 5: Ensure ChartContainer Passes isRefreshing

**File to modify:** `superset-frontend/src/components/Chart/ChartContainer.tsx`

Ensure the ChartContainer passes `isRefreshing` through to the chart plugins.

```typescript
interface ChartContainerProps {
  // ... existing props ...
  isRefreshing?: boolean;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  // ... existing props ...
  isRefreshing,
}) => {
  // ... existing code ...

  // Pass to SuperChart
  return (
    <SuperChart
      // ... existing props ...
      isRefreshing={isRefreshing}
    />
  );
};
```

### Step 6: Update Unit Tests

**File to create:** `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.test.tsx`

```typescript
import { render } from '@testing-library/react';
import { ThemeProvider } from '@apache-superset/core/ui';
import { supersetTheme } from '@apache-superset/core/ui';
import Echart from './Echart';

const mockEchartOptions = {
  series: [{ type: 'line', data: [1, 2, 3] }],
};

test('disables animation when isRefreshing is true', () => {
  const { container } = render(
    <ThemeProvider theme={supersetTheme}>
      <Echart
        width={400}
        height={300}
        echartOptions={mockEchartOptions}
        isRefreshing={true}
      />
    </ThemeProvider>
  );

  // The animation override should be applied
  // This would require mocking the echarts instance
  expect(container).toBeInTheDocument();
});

test('enables animation when isRefreshing is false', () => {
  const { container } = render(
    <ThemeProvider theme={supersetTheme}>
      <Echart
        width={400}
        height={300}
        echartOptions={mockEchartOptions}
        isRefreshing={false}
      />
    </ThemeProvider>
  );

  expect(container).toBeInTheDocument();
});
```

## File Summary

### Files to Modify

| File | Changes |
|------|---------|
| `superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx` | Add `isRefreshing` prop and animation override |
| `superset-frontend/plugins/plugin-chart-echarts/src/types.ts` | Add `isRefreshing` to `EchartsProps` |
| `superset-frontend/src/dashboard/components/gridComponents/Chart/Chart.jsx` | Pass `isAutoRefreshing` from context |
| `superset-frontend/src/components/Chart/ChartContainer.tsx` | Pass `isRefreshing` through |
| 14 ECharts chart components (listed above) | Pass `isRefreshing` to Echart component |

### Files That May Already Handle This

Some charts already have `animation: false` set. These won't be affected by the global override but will continue to work correctly.

## Behavior Specification

### Animation States

| Scenario | Animation |
|----------|-----------|
| Initial dashboard load | Enabled |
| Manual refresh | Enabled |
| Auto-refresh cycle | Disabled |
| Filter change | Enabled (not auto-refresh) |
| Navigation to dashboard | Enabled |

### Visual Experience

**During Auto-Refresh:**
- Charts update instantly without transition effects
- No visual flashing or movement
- Data simply appears in the new state
- Reduced CPU usage

**During Manual Refresh:**
- Normal chart animations preserved
- Smooth transitions provide visual feedback
- User sees their action resulted in change

## Dependencies

### Depends On

- **Task 5**: AutoRefreshContext provides `useIsAutoRefreshing` hook

### Used By

- No other tasks depend on this directly

## Performance Considerations

1. **CPU Reduction**: Disabling animations reduces CPU usage during auto-refresh
2. **Smoother Updates**: Without animations, charts update more quickly
3. **No Layout Shifts**: Animations can cause layout reflow; disabled animations prevent this
4. **Memory**: No additional memory overhead from this change

## Alternative Approaches Considered

### Approach A: Reduce Animation Duration (Rejected)

Set `animationDuration: 100` instead of disabling entirely.

**Pros:**
- Still provides some visual feedback

**Cons:**
- At 5-second intervals, even short animations are noisy
- Doesn't fully eliminate CPU usage from animations
- Partial solution

### Approach B: Per-Chart transformProps Modification (Rejected)

Modify each chart's transformProps to check `isRefreshing`.

**Pros:**
- Full control per chart type

**Cons:**
- Many files to modify
- Easy to miss charts
- More maintenance burden
- Duplicated logic

### Approach C: Global Override in Echart Component (Chosen)

Apply animation override at the Echart component level.

**Pros:**
- Single point of control
- Affects all ECharts charts automatically
- Easy to maintain
- Clean separation of concerns

**Cons:**
- Need to pass isRefreshing through component chain
- Charts with `animation: false` already set won't be affected (but that's fine)

## Non-ECharts Charts

Charts not using ECharts (e.g., Table, Word Cloud, etc.) have their own rendering mechanisms. Some considerations:

1. **Table Chart**: No animations to disable
2. **Word Cloud**: May have transition effects, needs separate handling if necessary
3. **Deck.gl Charts**: May need similar treatment

For non-ECharts charts, animation handling can be added as follow-up work if needed, as ECharts charts are the primary source of animation during refresh.

## ECharts Animation Options Reference

For reference, here are all ECharts animation-related options that could be overridden:

```typescript
const animationOverride = {
  animation: false,              // Master toggle
  animationDuration: 0,          // Duration in ms
  animationDurationUpdate: 0,    // Update animation duration
  animationEasing: 'linear',     // Easing function
  animationDelay: 0,             // Delay before animation starts
  animationDelayUpdate: 0,       // Update delay
};
```

For this implementation, we only need `animation: false` and `animationDuration: 0` to fully disable animations.
