export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const { colorScheme, metric, secondaryMetric } = formData;

  return {
    data: payload.data,
    colorScheme,
    metrics: [metric, secondaryMetric],
  };
}
