export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const { charge, linkLength } = formData;

  return {
    width,
    height,
    data: payload.data,
    charge,
    linkLength,
  };
}
