import { isDefined } from '@superset-ui/core';
import d3 from 'd3';

// DODO added #20704667
// v.y => v.x
export function computeXDomain(data) {
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].values)) {
    const extents = data
      .filter(d => !d.disabled)
      .map(row => d3.extent(row.values, v => v.x));
    const minOfMin = d3.min(extents, ([min]) => min);
    const maxOfMax = d3.max(extents, ([, max]) => max);

    return [minOfMin, maxOfMax];
  }

  return [0, 1];
}

// DODO added #20704667
// v.y => v.x
export function computeStackedXDomain(data) {
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0].values)) {
    const series = data
      .filter(d => !d.disabled)
      .map(d => d.values.map(v => v.x));
    const stackedValues = series[0].map((_, i) =>
      series.reduce((acc, cur) => acc + cur[i], 0),
    );

    return [Math.min(0, ...stackedValues), Math.max(0, ...stackedValues)];
  }

  return [0, 1];
}

// DODO added #20704667
// copy original and modify
// xAxisBounds => xAxisBounds
// yDomain => xDomain
// computeStackedYDomain => computeStackedXDomain
// computeYDomain => computeXDomain
export const applyXAxisBounds = ({
  chart,
  xAxisBounds,
  vizType,
  isVizTypes,
  data,
}) => {
  if (chart.yDomain && Array.isArray(xAxisBounds) && xAxisBounds.length === 2) {
    const [customMin, customMax] = xAxisBounds;
    const hasCustomMin = isDefined(customMin) && !Number.isNaN(customMin);
    const hasCustomMax = isDefined(customMax) && !Number.isNaN(customMax);

    if (
      (hasCustomMin || hasCustomMax) &&
      vizType === 'area' &&
      chart.style() === 'expand'
    ) {
      // Because there are custom bounds, we need to override them back to 0%-100% since this
      // is an expanded area chart
      chart.xDomain([0, 1]);
    } else if (
      (hasCustomMin || hasCustomMax) &&
      vizType === 'area' &&
      chart.style() === 'stream'
    ) {
      // Because there are custom bounds, we need to override them back to the domain of the
      // data since this is a stream area chart
      chart.xDomain(computeStackedYDomain(data));
    } else if (hasCustomMin && hasCustomMax) {
      // Override the y domain if there's both a custom min and max
      chart.xDomain([customMin, customMax]);
      chart.clipEdge(true);
    } else if (hasCustomMin || hasCustomMax) {
      // Only one of the bounds has been set, so we need to manually calculate the other one
      let [trueMin, trueMax] = [0, 1];

      // These viz types can be stacked
      // They correspond to the nvd3 stackedAreaChart and multiBarChart
      if (
        vizType === 'area' ||
        (isVizTypes(['bar', 'dist_bar']) && chart.stacked())
      ) {
        // This is a stacked area chart or a stacked bar chart
        [trueMin, trueMax] = computeStackedXDomain(data);
      } else {
        [trueMin, trueMax] = computeXDomain(data);
      }

      const min = hasCustomMin ? customMin : trueMin;
      const max = hasCustomMax ? customMax : trueMax;
      chart.xDomain([min, max]);
      chart.clipEdge(true);
    }
  }
};
