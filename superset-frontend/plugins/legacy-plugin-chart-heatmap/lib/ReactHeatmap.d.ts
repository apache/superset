declare var _default: import("react").ComponentClass<{
    data: import("prop-types").InferProps<{
        records: import("prop-types").Requireable<(import("prop-types").InferProps<{
            x: import("prop-types").Requireable<string>;
            y: import("prop-types").Requireable<string>;
            v: import("prop-types").Requireable<number>;
            perc: import("prop-types").Requireable<number>;
            rank: import("prop-types").Requireable<number>;
        }> | null)[]>;
        extents: import("prop-types").Requireable<(number | null)[]>;
    }> | null;
    width: number | null;
    height: number | null;
    bottomMargin: string | number | null;
    colorScheme: string | null;
    columnX: string | null;
    columnY: string | null;
    leftMargin: string | number | null;
    metric: string | object | null;
    normalized: boolean | null;
    numberFormat: string | null;
    showLegend: boolean | null;
    showPercentage: boolean | null;
    showValues: boolean | null;
    sortXAxis: string | null;
    sortYAxis: string | null;
    xScaleInterval: number | null;
    yScaleInterval: number | null;
    yAxisBounds: (number | null)[] | null;
} & import("packages/superset-ui-core/src/chart/components/reactify").ReactifyProps, any>;
export default _default;
//# sourceMappingURL=ReactHeatmap.d.ts.map