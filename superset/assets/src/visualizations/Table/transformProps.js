const DTTM_ALIAS = '__timestamp';

function transformData(data, formData) {
  const columns = new Set([
    ...formData.groupby,
    ...formData.metrics,
    ...formData.allColumns,
  ].map(column => column.label || column));

  let records = data;

  // handle timestamp columns
  if (formData.includeTime) {
    columns.add(DTTM_ALIAS);
  }

  // handle percentage columns.
  const percentMetrics = (formData.percentMetrics || [])
    .map(metric => metric.label || metric);
  if (percentMetrics.length > 0) {
    const sumPercentMetrics = data.reduce((sumMetrics, item) => {
      const newSumMetrics = { ...sumMetrics };
      percentMetrics.forEach((metric) => {
        newSumMetrics[metric] = (sumMetrics[metric] || 0) + (item[metric] || 0);
      });
      return newSumMetrics;
    }, {});
    records = data.map((item) => {
      const newItem = { ...item };
      percentMetrics.forEach((metric) => {
        newItem[`%${metric}`] = sumPercentMetrics[metric] !== 0
          ? newItem[metric] / sumPercentMetrics[metric] : null;
      });
      return newItem;
    });
    percentMetrics.forEach((metric) => {
      columns.add(`%${metric}`);
    });
  }

  // handle sortedby column
  if (formData.timeseriesLimitMetric) {
    const metric = formData.timeseriesLimitMetric.label || formData.timeseriesLimitMetric;
    columns.add(metric);
  }

  return {
    records,
    columns: [...columns],
  };
}

export default function transformProps(chartProps) {
  const {
    height,
    datasource,
    filters,
    formData,
    onAddFilter,
    payload,
  } = chartProps;
  const {
    alignPn,
    colorPn,
    includeSearch,
    metrics,
    orderDesc,
    pageLength,
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  } = formData;
  const { columnFormats, verboseMap } = datasource;
  const { records, columns } = transformData(payload.data, formData);

  const processedColumns = columns.map((key) => {
    let label = verboseMap[key];
    // Handle verbose names for percents
    if (!label) {
        label = key;
    }
    return {
      key,
      label,
      format: columnFormats && columnFormats[key],
    };
  });


  return {
    height,
    data: records,
    alignPositiveNegative: alignPn,
    colorPositiveNegative: colorPn,
    columns: processedColumns,
    filters,
    includeSearch,
    metrics,
    onAddFilter,
    orderDesc,
    pageLength: pageLength && parseInt(pageLength, 10),
    percentMetrics,
    tableFilter,
    tableTimestampFormat,
    timeseriesLimitMetric,
  };
}
