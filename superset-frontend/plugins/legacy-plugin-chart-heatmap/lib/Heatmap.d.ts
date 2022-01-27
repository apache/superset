export default Heatmap;
declare function Heatmap(element: any, props: any): void;
declare namespace Heatmap {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<PropTypes.InferProps<{
        records: PropTypes.Requireable<(PropTypes.InferProps<{
            x: PropTypes.Requireable<string>;
            y: PropTypes.Requireable<string>;
            v: PropTypes.Requireable<number>;
            perc: PropTypes.Requireable<number>;
            rank: PropTypes.Requireable<number>;
        }> | null)[]>;
        extents: PropTypes.Requireable<(number | null)[]>;
    }>>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const bottomMargin: PropTypes.Requireable<string | number>;
    const colorScheme: PropTypes.Requireable<string>;
    const columnX: PropTypes.Requireable<string>;
    const columnY: PropTypes.Requireable<string>;
    const leftMargin: PropTypes.Requireable<string | number>;
    const metric: PropTypes.Requireable<string | object>;
    const normalized: PropTypes.Requireable<boolean>;
    const numberFormat: PropTypes.Requireable<string>;
    const showLegend: PropTypes.Requireable<boolean>;
    const showPercentage: PropTypes.Requireable<boolean>;
    const showValues: PropTypes.Requireable<boolean>;
    const sortXAxis: PropTypes.Requireable<string>;
    const sortYAxis: PropTypes.Requireable<string>;
    const xScaleInterval: PropTypes.Requireable<number>;
    const yScaleInterval: PropTypes.Requireable<number>;
    const yAxisBounds: PropTypes.Requireable<(number | null)[]>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Heatmap.d.ts.map