export default Icicle;
declare function Icicle(element: any, props: any): void;
declare namespace Icicle {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(PropTypes.InferProps<{
        name: PropTypes.Requireable<string>;
        val: PropTypes.Validator<number>;
    }> | null)[]>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const colorScheme: PropTypes.Requireable<string>;
    const dateTimeFormat: PropTypes.Requireable<string>;
    const equalDateSize: PropTypes.Requireable<boolean>;
    const levels: PropTypes.Requireable<(string | null)[]>;
    const metrics: PropTypes.Requireable<(string | object | null)[]>;
    const numberFormat: PropTypes.Requireable<string>;
    const partitionLimit: PropTypes.Requireable<number>;
    const partitionThreshold: PropTypes.Requireable<number>;
    const timeSeriesOption: PropTypes.Requireable<string>;
    const useLogScale: PropTypes.Requireable<boolean>;
    const useRichTooltip: PropTypes.Requireable<boolean>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Partition.d.ts.map