export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
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
