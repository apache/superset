export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
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
