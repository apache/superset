export default function mainMetric(savedMetrics) {
    // Using 'count' as default metric if it exists, otherwise using whatever one shows up first
    let metric;
    if (savedMetrics && savedMetrics.length > 0) {
        savedMetrics.forEach(m => {
            if (m.metric_name === 'count') {
                metric = 'count';
            }
        });
        if (!metric) {
            metric = savedMetrics[0].metric_name;
        }
    }
    return metric;
}
//# sourceMappingURL=mainMetric.js.map