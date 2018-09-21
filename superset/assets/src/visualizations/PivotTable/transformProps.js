export default function transformProps(basicChartInput) {
  const { datasource, formData, payload } = basicChartInput;
  const {
    groupby: groupBy,
    numberFormat,
  } = formData;
  const {
    columnFormats,
    verboseMap,
  } = datasource;

  return {
    data: payload.data,
    columnFormats,
    groupBy,
    numberFormat,
    verboseMap,
  };
}
