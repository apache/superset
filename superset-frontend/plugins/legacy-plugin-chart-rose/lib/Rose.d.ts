export default Rose;
declare function Rose(element: any, props: any): void;
declare namespace Rose {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<{
        [x: string]: (PropTypes.InferProps<{
            key: PropTypes.Requireable<(string | null)[]>;
            name: PropTypes.Requireable<(string | null)[]>;
            time: PropTypes.Requireable<number>;
            value: PropTypes.Requireable<number>;
        }> | null)[] | null;
    }>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const dateTimeFormat: PropTypes.Requireable<string>;
    const numberFormat: PropTypes.Requireable<string>;
    const useRichTooltip: PropTypes.Requireable<boolean>;
    const useAreaProportions: PropTypes.Requireable<boolean>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Rose.d.ts.map