export default Sankey;
declare function Sankey(element: any, props: any): void;
declare namespace Sankey {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(PropTypes.InferProps<{
        source: PropTypes.Requireable<string>;
        target: PropTypes.Requireable<string>;
        value: PropTypes.Requireable<number>;
    }> | null)[]>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const colorScheme: PropTypes.Requireable<string>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Sankey.d.ts.map