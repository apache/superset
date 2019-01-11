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
    filterConfigs,
    instantFiltering,
    showDruidTimeGranularity,
    showDruidTimeOrigin,
    showSqlaTimeColumn,
    showSqlaTimeGranularity,
  } = formData;
  const { verboseMap } = datasource;

  const filtersFields = filterConfigs.map(flt => ({
    ...flt,
    key: flt.column,
    label: flt.label || verboseMap[flt.column] || flt.column,
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
