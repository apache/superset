export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const {
    horizonColorScale,
    seriesHeight,
  } = formData;

  return {
    data: payload.data,
    seriesHeight: parseInt(seriesHeight, 10),
    colorScale: horizonColorScale,
  };
}
