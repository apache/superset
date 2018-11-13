export default function transformProps(chartProps) {
  const { height, datasource, formData, payload } = chartProps;
  const {
    columnCollection,
    groupby,
    metrics,
    url,
  } = formData;
  const { records, columns } = payload.data;
  const isGroupBy = groupby.length > 0;

  // When there is a "group by",
  // each row in the table is a database column
  // Otherwise,
  // each row in the table is a metric
  let rows;
  if (isGroupBy) {
    rows = columns.map(column => (typeof column === 'object')
      ? column
      : { label: column });
  } else {
    const metricMap = datasource.metrics
      .reduce((acc, current) => {
        const map = acc;
        map[current.metric_name] = current;
        return map;
      }, {});

    rows = metrics.map(metric => (typeof metric === 'object')
      ? metric
      : metricMap[metric]);
  }

  // TODO: Better parse this from controls instead of mutative value here.
  columnCollection.forEach((column) => {
    const c = column;
    if (c.timeLag !== undefined && c.timeLag !== null && c.timeLag !== '') {
      c.timeLag = parseInt(c.timeLag, 10);
    }
  });

  return {
    height,
    data: records,
    columnConfigs: columnCollection,
    rows,
    rowType: isGroupBy ? 'column' : 'metric',
    url,
  };
}
