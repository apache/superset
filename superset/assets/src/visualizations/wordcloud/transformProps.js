function transformData(data, formData) {
  const { metric, series } = formData;
  if (metric && series) {
    const transformedData = data.map(datum => ({
      text: datum[series],
      size: datum[metric.label || metric],
    }));

    return transformedData;
  }
  return [];
}

export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    colorScheme,
    rotation,
    sizeTo,
    sizeFrom,
  } = formData;

  return {
    width,
    height,
    data: transformData(payload[0].data, formData),
    colorScheme,
    rotation,
    sizeRange: [sizeFrom, sizeTo],
  };
}
