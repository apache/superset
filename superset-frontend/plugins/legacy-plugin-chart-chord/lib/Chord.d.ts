export default Chord;
declare function Chord(element: any, props: any): void;
declare namespace Chord {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<PropTypes.InferProps<{
        matrix: PropTypes.Requireable<((number | null)[] | null)[]>;
        nodes: PropTypes.Requireable<(string | null)[]>;
    }>>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const colorScheme: PropTypes.Requireable<string>;
    const numberFormat: PropTypes.Requireable<string>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Chord.d.ts.map