export default SankeyLoop;
declare function SankeyLoop(element: any, props: any): void;
declare namespace SankeyLoop {
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
    const margin: PropTypes.Requireable<PropTypes.InferProps<{
        top: PropTypes.Requireable<number>;
        right: PropTypes.Requireable<number>;
        bottom: PropTypes.Requireable<number>;
        left: PropTypes.Requireable<number>;
    }>>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=SankeyLoop.d.ts.map