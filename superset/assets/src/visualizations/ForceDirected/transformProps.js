export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const { charge, linkLength } = formData;

  return {
    data: payload.data,
    charge,
    linkLength,
  };
}
