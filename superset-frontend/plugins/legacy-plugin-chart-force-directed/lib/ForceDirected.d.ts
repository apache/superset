export default ForceDirected;
declare function ForceDirected(element: any, props: any): void;
declare namespace ForceDirected {
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
    const linkLength: PropTypes.Requireable<number>;
    const charge: PropTypes.Requireable<number>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=ForceDirected.d.ts.map