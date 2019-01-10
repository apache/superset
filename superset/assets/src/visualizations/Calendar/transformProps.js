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
    xAxisTimeFormat,
    yAxisFormat,
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
    timeFormat: xAxisTimeFormat,
    valueFormat: yAxisFormat,
    verboseMap,
  };
}
