export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    includeSeries,
    linearColorScheme,
    metrics,
    secondaryMetric,
    series,
    showDatatable,
  } = formData;

  return {
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
