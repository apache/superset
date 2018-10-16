export default function transformProps(chartProps) {
  const { datasource, formData, payload } = chartProps;
  const {
    groupby,
    numberFormat,
  } = formData;
  const {
    columnFormats,
    verboseMap,
  } = datasource;

  return {
    data: payload.data,
    columnFormats,
    numGroups: groupby.length,
    numberFormat,
    verboseMap,
  };
}
