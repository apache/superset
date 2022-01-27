export default nvd3Vis;
declare function nvd3Vis(element: any, props: any): void;
declare namespace nvd3Vis {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    export const data: PropTypes.Requireable<PropTypes.InferProps<{
        markerLabels: PropTypes.Requireable<(string | null)[]>;
        markerLineLabels: PropTypes.Requireable<(string | null)[]>;
        markerLines: PropTypes.Requireable<(number | null)[]>;
        markers: PropTypes.Requireable<(number | null)[]>;
        measures: PropTypes.Requireable<(number | null)[]>;
        rangeLabels: PropTypes.Requireable<(string | null)[]>;
        ranges: PropTypes.Requireable<(number | null)[]>;
    }> | (PropTypes.InferProps<{
        x: PropTypes.Requireable<string>;
        y: PropTypes.Requireable<number>;
    }> | PropTypes.InferProps<{
        key: PropTypes.Requireable<(string | null)[]>;
        values: PropTypes.Requireable<(PropTypes.InferProps<{
            x: PropTypes.Requireable<number>;
            y: PropTypes.Requireable<number>;
        }> | null)[]>;
    }> | PropTypes.InferProps<{
        label: PropTypes.Requireable<string>;
        values: PropTypes.Requireable<(PropTypes.InferProps<{
            outliers: PropTypes.Requireable<(number | null)[]>;
            Q1: PropTypes.Requireable<number>;
            Q2: PropTypes.Requireable<number>;
            Q3: PropTypes.Requireable<number>;
            whisker_high: PropTypes.Requireable<number>;
            whisker_low: PropTypes.Requireable<number>;
        }> | null)[]>;
    }> | PropTypes.InferProps<{
        key: PropTypes.Requireable<string>;
        values: PropTypes.Requireable<(object | null)[]>;
    }> | null)[]>;
    export const width: PropTypes.Requireable<number>;
    export const height: PropTypes.Requireable<number>;
    export const annotationData: PropTypes.Requireable<object>;
    export const annotationLayers: PropTypes.Requireable<(PropTypes.InferProps<{
        annotationType: PropTypes.Requireable<string>;
        color: PropTypes.Requireable<string>;
        hideLine: PropTypes.Requireable<boolean>;
        name: PropTypes.Requireable<string>;
        opacity: PropTypes.Requireable<string>;
        show: PropTypes.Requireable<boolean>;
        showMarkers: PropTypes.Requireable<boolean>;
        sourceType: PropTypes.Requireable<string>;
        style: PropTypes.Requireable<string>;
        value: PropTypes.Requireable<string | number>;
        width: PropTypes.Requireable<number>;
    }> | null)[]>;
    export { numberOrAutoType as bottomMargin };
    export const colorScheme: PropTypes.Requireable<string>;
    export const comparisonType: PropTypes.Requireable<string>;
    export const contribution: PropTypes.Requireable<boolean>;
    export { numberOrAutoType as leftMargin };
    export const onError: PropTypes.Requireable<(...args: any[]) => any>;
    export const showLegend: PropTypes.Requireable<boolean>;
    export const showMarkers: PropTypes.Requireable<boolean>;
    export const useRichTooltip: PropTypes.Requireable<boolean>;
    export const vizType: PropTypes.Requireable<string>;
    export const xAxisFormat: PropTypes.Requireable<string>;
    export const numberFormat: PropTypes.Requireable<string>;
    export const xAxisLabel: PropTypes.Requireable<string>;
    export const xAxisShowMinMax: PropTypes.Requireable<boolean>;
    export const xIsLogScale: PropTypes.Requireable<boolean>;
    export const xTicksLayout: PropTypes.Requireable<string>;
    export const yAxisFormat: PropTypes.Requireable<string>;
    export const yAxisBounds: PropTypes.Requireable<(number | null)[]>;
    export const yAxisLabel: PropTypes.Requireable<string>;
    export const yAxisShowMinMax: PropTypes.Requireable<boolean>;
    export const yIsLogScale: PropTypes.Requireable<boolean>;
    export const orderBars: PropTypes.Requireable<boolean>;
    export const isBarStacked: PropTypes.Requireable<boolean>;
    export const showBarValue: PropTypes.Requireable<boolean>;
    export const reduceXTicks: PropTypes.Requireable<boolean>;
    export const showControls: PropTypes.Requireable<boolean>;
    export const showBrush: PropTypes.Requireable<string | boolean>;
    export const onBrushEnd: PropTypes.Requireable<(...args: any[]) => any>;
    export const yAxis2Format: PropTypes.Requireable<string>;
    export const lineInterpolation: PropTypes.Requireable<string>;
    export const isDonut: PropTypes.Requireable<boolean>;
    export const isPieLabelOutside: PropTypes.Requireable<boolean>;
    export const pieLabelType: PropTypes.Requireable<string>;
    export const showLabels: PropTypes.Requireable<boolean>;
    export const areaStackedStyle: PropTypes.Requireable<string>;
    export const entity: PropTypes.Requireable<string>;
    export const maxBubbleSize: PropTypes.Requireable<number>;
    export { stringOrObjectWithLabelType as xField };
    export { stringOrObjectWithLabelType as yField };
    export { stringOrObjectWithLabelType as sizeField };
    export { rgbObjectType as baseColor };
}
import PropTypes from "prop-types";
import { numberOrAutoType } from "./PropTypes";
import { stringOrObjectWithLabelType } from "./PropTypes";
import { rgbObjectType } from "./PropTypes";
//# sourceMappingURL=NVD3Vis.d.ts.map