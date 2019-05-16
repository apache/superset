import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/chart';
import { Hooks, RenderingFormData } from './Line';

/* eslint-disable sort-keys */

export default function transformProps(chartProps: ChartProps) {
  const { width, height, payload } = chartProps;
  const { data } = payload;
  const formData = chartProps.formData as RenderingFormData;
  const hooks = chartProps.hooks as Hooks;

  /**
   * Use type-check to make sure the field names are expected ones
   * and only pick these fields to pass to the chart.
   */
  const fieldsFromFormData: (keyof RenderingFormData)[] = [
    'commonEncoding',
    'encoding',
    'margin',
    'options',
    'theme',
  ];

  const fieldsFromHooks: (keyof Hooks)[] = [
    'TooltipRenderer',
    'LegendGroupRenderer',
    'LegendItemRenderer',
    'LegendItemMarkRenderer',
    'LegendItemLabelRenderer',
  ];

  return {
    data,
    width,
    height,
    ...pick(formData, fieldsFromFormData),
    ...pick(hooks, fieldsFromHooks),
  };
}
