export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const {
    colorScheme,
    dateTimeFormat,
    numberFormat,
    richTooltip,
    roseAreaProportion,
  } = formData;

  return {
    data: payload.data,
    colorScheme,
    dateTimeFormat,
    numberFormat,
    useAreaProportions: roseAreaProportion,
    useRichTooltip: richTooltip,
  };
}
