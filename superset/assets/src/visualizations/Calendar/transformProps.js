export default function transformProps(chartProps) {
  const { formData, payload, datasource } = chartProps;
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
