export default WorldMap;
declare function WorldMap(element: any, props: any): void;
declare namespace WorldMap {
    export const displayName: string;
    export { propTypes };
}
declare namespace propTypes {
    const data: PropTypes.Requireable<(PropTypes.InferProps<{
        country: PropTypes.Requireable<string>;
        latitude: PropTypes.Requireable<number>;
        longitude: PropTypes.Requireable<number>;
        name: PropTypes.Requireable<string>;
        m1: PropTypes.Requireable<number>;
        m2: PropTypes.Requireable<number>;
    }> | null)[]>;
    const height: PropTypes.Requireable<number>;
    const maxBubbleSize: PropTypes.Requireable<number>;
    const showBubbles: PropTypes.Requireable<boolean>;
    const linearColorScheme: PropTypes.Requireable<string>;
    const color: PropTypes.Requireable<string>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=WorldMap.d.ts.map