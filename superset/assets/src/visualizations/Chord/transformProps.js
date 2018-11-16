export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const { yAxisFormat, colorScheme } = formData;

  return {
    width,
    height,
    data: payload.data,
    numberFormat: yAxisFormat,
    colorScheme,
  };
}
