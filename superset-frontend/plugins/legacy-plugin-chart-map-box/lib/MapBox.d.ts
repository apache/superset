export const DEFAULT_MAX_ZOOM: 16;
export const DEFAULT_POINT_RADIUS: 60;
export default MapBox;
declare class MapBox extends React.Component<any, any, any> {
    constructor(props: any);
    handleViewportChange(viewport: any): void;
}
declare namespace MapBox {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const aggregatorName: PropTypes.Requireable<string>;
    const clusterer: PropTypes.Requireable<object>;
    const globalOpacity: PropTypes.Requireable<number>;
    const hasCustomMetric: PropTypes.Requireable<boolean>;
    const mapStyle: PropTypes.Requireable<string>;
    const mapboxApiKey: PropTypes.Validator<string>;
    const onViewportChange: PropTypes.Requireable<(...args: any[]) => any>;
    const pointRadius: PropTypes.Requireable<number>;
    const pointRadiusUnit: PropTypes.Requireable<string>;
    const renderWhileDragging: PropTypes.Requireable<boolean>;
    const rgb: PropTypes.Requireable<any[]>;
    const bounds: PropTypes.Requireable<any[]>;
}
declare namespace defaultProps {
    const width_1: number;
    export { width_1 as width };
    const height_1: number;
    export { height_1 as height };
    const globalOpacity_1: number;
    export { globalOpacity_1 as globalOpacity };
    export { NOOP as onViewportChange };
    export { DEFAULT_POINT_RADIUS as pointRadius };
    const pointRadiusUnit_1: string;
    export { pointRadiusUnit_1 as pointRadiusUnit };
}
import PropTypes from "prop-types";
declare function NOOP(): void;
//# sourceMappingURL=MapBox.d.ts.map