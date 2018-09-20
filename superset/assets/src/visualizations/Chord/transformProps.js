export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { yAxisFormat: numberFormat, colorScheme } = formData;

  return {
    data: payload.data,
    numberFormat,
    colorScheme,
  };
}
