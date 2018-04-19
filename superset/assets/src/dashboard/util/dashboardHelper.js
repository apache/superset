export function getChartIdsFromLayout(layout) {
  return Object.values(layout)
    .reduce((chartIds, value) => {
      if (value && value.meta && value.meta.chartId) {
        chartIds.push(value.meta.chartId);
      }
      return chartIds;
    }, []);
}
