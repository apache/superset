export default Sunburst;
declare function Sunburst(element: any, props: any): void;
declare namespace Sunburst {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(any[] | null)[]>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const colorScheme: PropTypes.Requireable<string>;
    const linearColorScheme: PropTypes.Requireable<string>;
    const numberFormat: PropTypes.Requireable<string>;
    const metrics: PropTypes.Requireable<(string | object | null)[]>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Sunburst.d.ts.map