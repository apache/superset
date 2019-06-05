import { ChartTheme } from '@data-ui/theme';
import XYChartLayout, { XYChartLayoutConfig } from './XYChartLayout';

export default function createXYChartLayoutWithTheme(
  config: XYChartLayoutConfig & { theme: ChartTheme },
) {
  const {
    width,
    height,
    minContentWidth,
    minContentHeight,
    margin,
    xEncoder,
    yEncoder,
    theme,
  } = config;

  return new XYChartLayout({
    height,
    margin,
    minContentHeight,
    minContentWidth,
    width,
    xEncoder,
    // @ts-ignore
    xTickSize: theme.xTickStyles.length || theme.xTickStyles.tickLength,
    xTickTextStyle: theme.xTickStyles.label.bottom || theme.xTickStyles.label.top,
    yEncoder,
    // @ts-ignore
    yTickSize: theme.yTickStyles.length || theme.yTickStyles.tickLength,
    yTickTextStyle: theme.yTickStyles.label.left || theme.yTickStyles.label.right,
  });
}
