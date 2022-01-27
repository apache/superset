export const numberOrAutoType: PropTypes.Requireable<string | number>;
export const stringOrObjectWithLabelType: PropTypes.Requireable<string | PropTypes.InferProps<{
    label: PropTypes.Requireable<string>;
}>>;
export const rgbObjectType: PropTypes.Requireable<PropTypes.InferProps<{
    r: PropTypes.Validator<number>;
    g: PropTypes.Validator<number>;
    b: PropTypes.Validator<number>;
}>>;
export const numericXYType: PropTypes.Requireable<PropTypes.InferProps<{
    x: PropTypes.Requireable<number>;
    y: PropTypes.Requireable<number>;
}>>;
export const categoryAndValueXYType: PropTypes.Requireable<PropTypes.InferProps<{
    x: PropTypes.Requireable<string>;
    y: PropTypes.Requireable<number>;
}>>;
export const boxPlotValueType: PropTypes.Requireable<PropTypes.InferProps<{
    outliers: PropTypes.Requireable<(number | null)[]>;
    Q1: PropTypes.Requireable<number>;
    Q2: PropTypes.Requireable<number>;
    Q3: PropTypes.Requireable<number>;
    whisker_high: PropTypes.Requireable<number>;
    whisker_low: PropTypes.Requireable<number>;
}>>;
export const bulletDataType: PropTypes.Requireable<PropTypes.InferProps<{
    markerLabels: PropTypes.Requireable<(string | null)[]>;
    markerLineLabels: PropTypes.Requireable<(string | null)[]>;
    markerLines: PropTypes.Requireable<(number | null)[]>;
    markers: PropTypes.Requireable<(number | null)[]>;
    measures: PropTypes.Requireable<(number | null)[]>;
    rangeLabels: PropTypes.Requireable<(string | null)[]>;
    ranges: PropTypes.Requireable<(number | null)[]>;
}>>;
export const annotationLayerType: PropTypes.Requireable<PropTypes.InferProps<{
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
}>>;
import PropTypes from "prop-types";
//# sourceMappingURL=PropTypes.d.ts.map