export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    includeSeries,
    linearColorScheme,
    metrics,
    secondaryMetric,
    series,
    showDatatable,
  } = formData;

  return {
    width,
    height,
    data: payload.data,
    includeSeries,
    linearColorScheme,
    metrics: metrics.map(m => m.label || m),
    colorMetric: secondaryMetric && secondaryMetric.label
      ? secondaryMetric.label
      : secondaryMetric,
    series,
    showDatatable,
  };
}
