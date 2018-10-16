export default function transformProps(chartProps) {
  const { datasource, formData, payload } = chartProps;
  const {
    colorScheme,
    dateTimeFormat,
    equalDateSize,
    groupby,
    logScale,
    metrics,
    numberFormat,
    partitionLimit,
    partitionThreshold,
    richTooltip,
    timeSeriesOption,
  } = formData;
  const { verboseMap } = datasource;

  return {
    data: payload.data,
    colorScheme,
    dateTimeFormat,
    equalDateSize,
    levels: groupby.map(g => verboseMap[g] || g),
    metrics,
    numberFormat,
    partitionLimit: partitionLimit && parseInt(partitionLimit, 10),
    partitionThreshold: partitionThreshold && parseInt(partitionThreshold, 10),
    timeSeriesOption,
    useLogScale: logScale,
    useRichTooltip: richTooltip,
  };
}
