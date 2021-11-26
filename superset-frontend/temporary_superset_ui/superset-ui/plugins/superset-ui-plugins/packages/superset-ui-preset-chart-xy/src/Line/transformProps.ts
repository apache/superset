import { ChartProps } from '@superset-ui/chart';

/* eslint-disable sort-keys */

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, payload } = chartProps;
  const { encoding } = formData;
  const { data } = payload;

  return {
    data,
    width,
    height,
    encoding,
  };
}
