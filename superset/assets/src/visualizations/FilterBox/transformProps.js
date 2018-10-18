export default function transformProps(chartProps) {
  const {
    datasource,
    filters,
    formData,
    onAddFilter,
    payload,
    rawDatasource,
  } = chartProps;
  const {
    dateFilter,
    groupby,
    instantFiltering,
    showDruidTimeGranularity,
    showDruidTimeOrigin,
    showSqlaTimeColumn,
    showSqlaTimeGranularity,
  } = formData;
  const { verboseMap } = datasource;

  const filtersFields = groupby.map(key => ({
    key,
    label: verboseMap[key] || key,
  }));

  return {
    datasource: rawDatasource,
    filtersFields,
    filtersChoices: payload.data,
    instantFiltering,
    onChange: onAddFilter,
    origSelectedValues: filters || {},
    showDateFilter: dateFilter,
    showDruidTimeGrain: showDruidTimeGranularity,
    showDruidTimeOrigin,
    showSqlaTimeColumn,
    showSqlaTimeGrain: showSqlaTimeGranularity,
  };
}
