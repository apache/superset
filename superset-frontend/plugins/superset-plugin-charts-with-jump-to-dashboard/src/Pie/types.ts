import {
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
  LegendOrientation,
  LegendType,
} from '@superset-ui/plugin-chart-echarts';
import { DEFAULT_LEGEND_FORM_DATA } from '../../../plugin-chart-echarts/src/constants';
import {
  EchartsPieLabelType,
  EchartsPieFormData,
} from '../../../plugin-chart-echarts/src/Pie/types';

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsPieFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  donut: false,
  groupby: [],
  innerRadius: 30,
  labelLine: false,
  labelType: EchartsPieLabelType.Key,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  outerRadius: 70,
  showLabels: true,
  labelsOutside: true,
  showLabelsThreshold: 5,
  dateFormat: 'smart_date',
  jumpToDashboard: '{}',
};

export type PieChartTransformedProps =
  BaseTransformedProps<EchartsPieFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps;
