export default ScatterPlotGlowOverlay;
declare class ScatterPlotGlowOverlay extends React.PureComponent<any, any, any> {
    constructor(props: any);
    redraw({ width, height, ctx, isDragging, project }: {
        width: any;
        height: any;
        ctx: any;
        isDragging: any;
        project: any;
    }): void;
    drawText(ctx: any, pixel: any, options?: {}): void;
}
declare namespace ScatterPlotGlowOverlay {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const aggregation: PropTypes.Requireable<string>;
    const compositeOperation: PropTypes.Requireable<string>;
    const dotRadius: PropTypes.Requireable<number>;
    const lngLatAccessor: PropTypes.Requireable<(...args: any[]) => any>;
    const locations: PropTypes.Validator<(object | null)[]>;
    const pointRadiusUnit: PropTypes.Requireable<string>;
    const renderWhileDragging: PropTypes.Requireable<boolean>;
    const rgb: PropTypes.Requireable<(string | number | null)[]>;
    const zoom: PropTypes.Requireable<number>;
}
declare namespace defaultProps {
    const compositeOperation_1: string;
    export { compositeOperation_1 as compositeOperation };
    const dotRadius_1: number;
    export { dotRadius_1 as dotRadius };
    export function lngLatAccessor_1(location: any): any[];
    export { lngLatAccessor_1 as lngLatAccessor };
    const renderWhileDragging_1: boolean;
    export { renderWhileDragging_1 as renderWhileDragging };
}
import PropTypes from "prop-types";
//# sourceMappingURL=ScatterPlotGlowOverlay.d.ts.map