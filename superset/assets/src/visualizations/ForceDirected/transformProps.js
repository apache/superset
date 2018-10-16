export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const { charge, linkLength } = formData;

  return {
    data: payload.data,
    charge,
    linkLength,
  };
}
