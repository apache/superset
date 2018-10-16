export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const { yAxisFormat, colorScheme } = formData;

  return {
    data: payload.data,
    numberFormat: yAxisFormat,
    colorScheme,
  };
}
