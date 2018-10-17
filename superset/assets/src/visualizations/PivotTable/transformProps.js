export default function transformProps(chartProps) {
  const { height, datasource, formData, payload } = chartProps;
  const {
    groupby,
    numberFormat,
  } = formData;
  const {
    columnFormats,
    verboseMap,
  } = datasource;

  return {
    height,
    data: payload.data,
    columnFormats,
    numGroups: groupby.length,
    numberFormat,
    verboseMap,
  };
}
