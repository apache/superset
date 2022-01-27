export default CountryMap;
declare function CountryMap(element: any, props: any): void;
declare namespace CountryMap {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(PropTypes.InferProps<{
        country_id: PropTypes.Requireable<string>;
        metric: PropTypes.Requireable<number>;
    }> | null)[]>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const country: PropTypes.Requireable<string>;
    const linearColorScheme: PropTypes.Requireable<string>;
    const mapBaseUrl: PropTypes.Requireable<string>;
    const numberFormat: PropTypes.Requireable<string>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=CountryMap.d.ts.map