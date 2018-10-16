export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const { colorScheme } = formData;

  return {
    data: payload.data,
    colorScheme,
  };
}
