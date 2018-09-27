export default function transformProps(basicChartInput) {
  const { datasource, formData, payload } = basicChartInput;
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
    groupBy: groupby,
    numberFormat,
    verboseMap,
  };
}
