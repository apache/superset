export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    colorScheme,
    linkLength,
    normalized,
    globalOpacity,
    xAxisLabel,
    yAxisLabel,
  } = formData;

  return {
    data: payload.data,
    binCount: parseInt(linkLength, 10),
    colorScheme,
    normalized,
    opacity: globalOpacity,
    xAxisLabel,
    yAxisLabel,
  };
}
