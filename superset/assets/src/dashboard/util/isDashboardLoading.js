export default function isDashboardLoading(charts) {
  return Object.values(charts).some(
    chart => chart.chartUpdateStartTime > (chart.chartUpdateEndTime || 0),
  );
}
