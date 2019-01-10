function transformData(data, formData) {
  const { metric, series } = formData;

  const transformedData = data.map(datum => ({
    text: datum[series],
    size: datum[metric.label || metric],
  }));

  return transformedData;
}

export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    colorScheme,
    rotation,
    sizeTo,
    sizeFrom,
  } = formData;

  return {
    data: transformData(payload.data, formData),
    colorScheme,
    rotation,
    sizeRange: [sizeFrom, sizeTo],
  };
}
