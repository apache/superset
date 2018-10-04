export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { colorScheme } = formData;

  return {
    data: payload.data,
    colorScheme,
  };
}
