import { ChartTheme } from '@data-ui/theme';
import { Value } from 'encodable';
import XYChartLayout, { XYChartLayoutConfig } from './XYChartLayout';

export default function createXYChartLayoutWithTheme<XOutput extends Value, YOutput extends Value>(
  config: XYChartLayoutConfig<XOutput, YOutput> & {
    theme: ChartTheme;
  },
) {
  const { theme, ...rest } = config;

  return new XYChartLayout<XOutput, YOutput>({
    ...rest,
    // @ts-ignore
    xTickSize: theme.xTickStyles.length || theme.xTickStyles.tickLength,
    xTickTextStyle: theme.xTickStyles.label.bottom || theme.xTickStyles.label.top,
    // @ts-ignore
    yTickSize: theme.yTickStyles.length || theme.yTickStyles.tickLength,
    yTickTextStyle: theme.yTickStyles.label.left || theme.yTickStyles.label.right,
  });
}
