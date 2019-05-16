import { ChartProps } from '@superset-ui/chart';
import ChartFormData from './ChartFormData';

/* eslint-disable sort-keys */

export default function transformProps(chartProps: ChartProps) {
  const { width, height, payload } = chartProps;
  const formData = chartProps.formData as ChartFormData;
  const { encoding, margin, theme } = formData;
  const { data } = payload;

  return {
    data,
    width,
    height,
    encoding,
    margin,
    theme,
  };
}
