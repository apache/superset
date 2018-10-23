export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    colorScheme,
    numberFormat,
    treemapRatio,
  } = formData;

  return {
    data: payload.data,
    colorScheme,
    numberFormat,
    treemapRatio,
  };
}
