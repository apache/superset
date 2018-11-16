export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    colorScheme,
    linkLength,
    normalized,
    globalOpacity,
    xAxisLabel,
    yAxisLabel,
  } = formData;

  return {
    width,
    height,
    data: payload.data,
    binCount: parseInt(linkLength, 10),
    colorScheme,
    normalized,
    opacity: globalOpacity,
    xAxisLabel,
    yAxisLabel,
  };
}
