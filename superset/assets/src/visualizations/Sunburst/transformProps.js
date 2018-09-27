export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { colorScheme, metric, secondaryMetric } = formData;

  return {
    data: payload.data,
    colorScheme,
    metrics: [metric, secondaryMetric],
  };
}
