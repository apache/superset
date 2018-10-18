export default function transformProps(chartProps) {
  const { width, formData, payload } = chartProps;
  const {
    horizonColorScale,
    seriesHeight,
  } = formData;

  return {
    width,
    data: payload.data,
    seriesHeight: parseInt(seriesHeight, 10),
    colorScale: horizonColorScale,
  };
}
