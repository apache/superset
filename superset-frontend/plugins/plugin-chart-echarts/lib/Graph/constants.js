export const DEFAULT_GRAPH_SERIES_OPTION = {
    zoom: 0.7,
    circular: { rotateLabel: true },
    force: {
        initLayout: 'circular',
        layoutAnimation: true,
    },
    label: {
        show: true,
        position: 'right',
        distance: 5,
        rotate: 0,
        offset: [0, 0],
        fontStyle: 'normal',
        fontWeight: 'normal',
        fontFamily: 'sans-serif',
        fontSize: 12,
        padding: [0, 0, 0, 0],
        overflow: 'truncate',
        formatter: '{b}',
    },
    emphasis: {
        focus: 'adjacency',
    },
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut',
    lineStyle: { color: 'source', curveness: 0.1 },
    select: {
        itemStyle: { borderWidth: 3, opacity: 1 },
        label: { fontWeight: 'bolder' },
    },
    // Ref: https://echarts.apache.org/en/option.html#series-graph.data.tooltip.formatter
    //   - b: data name
    //   - c: data value
    tooltip: { formatter: '{b}: {c}' },
};
//# sourceMappingURL=constants.js.map