export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { yAxisFormat, colorScheme } = formData;

  return {
    data: payload.data,
    numberFormat: yAxisFormat,
    colorScheme,
  };
}
