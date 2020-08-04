import { ChartTheme } from '@data-ui/theme';
import { Value } from 'encodable';
import XYChartLayout, { XYChartLayoutConfig } from './XYChartLayout';
export default function createXYChartLayoutWithTheme<XOutput extends Value, YOutput extends Value>(config: XYChartLayoutConfig<XOutput, YOutput> & {
    theme: ChartTheme;
}): XYChartLayout<XOutput, YOutput>;
//# sourceMappingURL=createXYChartLayoutWithTheme.d.ts.map