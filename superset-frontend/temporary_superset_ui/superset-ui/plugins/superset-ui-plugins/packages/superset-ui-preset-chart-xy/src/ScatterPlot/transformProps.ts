import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/chart';
import { HookProps } from '../components/ScatterPlot/ScatterPlot';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queryData } = chartProps;
  const { encoding, margin, theme } = formData;
  const { data } = queryData;
  const hooks = chartProps.hooks as HookProps;

  const fieldsFromHooks: (keyof HookProps)[] = [
    'TooltipRenderer',
    'LegendRenderer',
    'LegendGroupRenderer',
    'LegendItemRenderer',
    'LegendItemMarkRenderer',
    'LegendItemLabelRenderer',
  ];

  return {
    data,
    width,
    height,
    encoding,
    margin,
    theme,
    ...pick(hooks, fieldsFromHooks),
  };
}
