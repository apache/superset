export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    bottomMargin,
    canvasImageRendering,
    allColumnsX,
    allColumnsY,
    linearColorScheme,
    leftMargin,
    metric,
    normalized,
    showLegend,
    showPerc,
    showValues,
    sortXAxis,
    sortYAxis,
    xscaleInterval,
    yscaleInterval,
    yAxisBounds,
    yAxisFormat,
  } = formData;

  return {
    data: payload.data,
    bottomMargin,
    canvasImageRendering,
    colorScheme: linearColorScheme,
    columnX: allColumnsX,
    columnY: allColumnsY,
    leftMargin,
    metric,
    normalized,
    numberFormat: yAxisFormat,
    showLegend,
    showPercentage: showPerc,
    showValues,
    sortXAxis,
    sortYAxis,
    xScaleInterval: parseInt(xscaleInterval, 10),
    yScaleInterval: parseInt(yscaleInterval, 10),
    yAxisBounds,
  };
}
