export default HorizonChart;
declare class HorizonChart extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
}
declare namespace HorizonChart {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const className: PropTypes.Requireable<string>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const seriesHeight: PropTypes.Requireable<number>;
    const data: PropTypes.Validator<(PropTypes.InferProps<{
        key: PropTypes.Requireable<(string | null)[]>;
        values: PropTypes.Requireable<(PropTypes.InferProps<{
            y: PropTypes.Requireable<number>;
        }> | null)[]>;
    }> | null)[]>;
    const bands: PropTypes.Requireable<number>;
    const colors: PropTypes.Requireable<(string | null)[]>;
    const colorScale: PropTypes.Requireable<string>;
    const mode: PropTypes.Requireable<string>;
    const offsetX: PropTypes.Requireable<number>;
}
declare namespace defaultProps {
    const className_1: string;
    export { className_1 as className };
    const width_1: number;
    export { width_1 as width };
    const height_1: number;
    export { height_1 as height };
    const seriesHeight_1: number;
    export { seriesHeight_1 as seriesHeight };
    const bands_1: number;
    export { bands_1 as bands };
    export { DEFAULT_COLORS as colors };
    const colorScale_1: string;
    export { colorScale_1 as colorScale };
    const mode_1: string;
    export { mode_1 as mode };
    const offsetX_1: number;
    export { offsetX_1 as offsetX };
}
import PropTypes from "prop-types";
import { DEFAULT_COLORS } from "./HorizonRow";
//# sourceMappingURL=HorizonChart.d.ts.map