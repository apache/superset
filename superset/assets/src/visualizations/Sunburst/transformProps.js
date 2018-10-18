export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const { colorScheme, metric, secondaryMetric } = formData;

  return {
    width,
    height,
    data: payload.data,
    colorScheme,
    metrics: [metric, secondaryMetric],
  };
}
