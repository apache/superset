export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    colorScheme,
    numberFormat,
    treemapRatio,
  } = formData;

  return {
    width,
    height,
    data: payload.data,
    colorScheme,
    numberFormat,
    treemapRatio,
  };
}
