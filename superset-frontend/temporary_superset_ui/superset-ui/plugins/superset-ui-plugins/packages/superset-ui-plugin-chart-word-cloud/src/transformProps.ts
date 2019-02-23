import { ChartProps } from '@superset-ui/chart';

function transformData(data: ChartProps['payload'][], formData: ChartProps['formData']) {
  const { metric, series } = formData;

  const transformedData = data.map(datum => ({
    size: datum[metric.label || metric],
    text: datum[series],
  }));

  return transformedData;
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, payload } = chartProps;
  const { colorScheme, rotation, sizeTo, sizeFrom } = formData;

  return {
    colorScheme,
    data: transformData(payload.data, formData),
    height,
    rotation,
    sizeRange: [sizeFrom, sizeTo],
    width,
  };
}
