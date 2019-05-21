import { createSelector } from 'reselect';
import XYChartLayout, { XYChartLayoutConfig } from '../XYChartLayout';

export default function createXYChartLayoutSelector() {
  return createSelector(
    (input: XYChartLayoutConfig) => input.width,
    input => input.height,
    input => input.minContentWidth,
    input => input.minContentHeight,
    input => input.margin,
    input => input.xEncoder,
    input => input.yEncoder,
    input => input.children,
    input => input.theme,
    (
      width,
      height,
      minContentWidth,
      minContentHeight,
      margin,
      xEncoder,
      yEncoder,
      children,
      theme,
    ) =>
      new XYChartLayout({
        children,
        height,
        margin,
        minContentHeight,
        minContentWidth,
        theme,
        width,
        xEncoder,
        yEncoder,
      }),
  );
}
