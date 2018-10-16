export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
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
