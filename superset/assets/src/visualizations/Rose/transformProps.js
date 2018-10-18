export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    colorScheme,
    dateTimeFormat,
    numberFormat,
    richTooltip,
    roseAreaProportion,
  } = formData;

  return {
    width,
    height,
    data: payload.data,
    colorScheme,
    dateTimeFormat,
    numberFormat,
    useAreaProportions: roseAreaProportion,
    useRichTooltip: richTooltip,
  };
}
