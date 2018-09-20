export default function transformProps(basicChartInput) {
  const { formData, payload, datasource } = basicChartInput;
  const {
    cellPadding,
    cellRadius,
    cellSize,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    xAxisTimeFormat: timeFormat,
    yAxisFormat: valueFormat,
  } = formData;

  const { verboseMap } = datasource;

  return {
    data: payload.data,
    cellPadding,
    cellRadius,
    cellSize,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    timeFormat,
    valueFormat,
    verboseMap,
  };
}
