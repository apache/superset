export default Treemap;
declare function Treemap(element: any, props: any): void;
declare namespace Treemap {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(PropTypes.InferProps<{
        name: PropTypes.Requireable<string>;
        value: PropTypes.Validator<number>;
    }> | PropTypes.InferProps<{
        name: PropTypes.Requireable<string>;
        children: PropTypes.Requireable<(PropTypes.InferProps<PropTypes.ValidationMap<any>> | null)[]>;
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
    const numberFormat: PropTypes.Requireable<string>;
    const treemapRatio: PropTypes.Requireable<number>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Treemap.d.ts.map