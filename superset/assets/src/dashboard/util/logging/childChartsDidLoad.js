import findNonTabChildCharIds from './findNonTabChildChartIds';

export default function childChartsDidLoad({ chartQueries, layout, id }) {
  const chartIds = findNonTabChildCharIds({ id, layout });

  let minQueryStartTime = Infinity;
  const didLoad = chartIds.every(chartId => {
    const query = chartQueries[chartId] || {};

    // filterbox's don't re-render, don't use stale update time
    if (query.formData && query.formData.viz_type !== 'filter_box') {
      minQueryStartTime = Math.min(
        query.chartUpdateStartTime,
        minQueryStartTime,
      );
    }
    return ['stopped', 'failed', 'rendered'].indexOf(query.chartStatus) > -1;
  });

  return { didLoad, minQueryStartTime };
}
