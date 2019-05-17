import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/chart';
import { HookProps, FormDataProps } from './Line';

/* eslint-disable sort-keys */

export default function transformProps(chartProps: ChartProps) {
  const { width, height, payload } = chartProps;
  const { data } = payload;
  const formData = chartProps.formData as FormDataProps;
  const hooks = chartProps.hooks as HookProps;

  /**
   * Use type-check to make sure the field names are expected ones
   * and only pick these fields to pass to the chart.
   */
  const fieldsFromFormData: (keyof FormDataProps)[] = [
    'commonEncoding',
    'encoding',
    'margin',
    'options',
    'theme',
  ];

  const fieldsFromHooks: (keyof HookProps)[] = [
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
