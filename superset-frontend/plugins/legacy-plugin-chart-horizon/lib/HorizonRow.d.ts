export const DEFAULT_COLORS: string[];
export default HorizonRow;
declare class HorizonRow extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
    canvas: HTMLCanvasElement | null | undefined;
    drawChart(): void;
}
declare namespace HorizonRow {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const className: PropTypes.Requireable<string>;
    const width: PropTypes.Requireable<number>;
    const height: PropTypes.Requireable<number>;
    const data: PropTypes.Validator<(PropTypes.InferProps<{
        y: PropTypes.Requireable<number>;
    }> | null)[]>;
    const bands: PropTypes.Requireable<number>;
    const colors: PropTypes.Requireable<(string | null)[]>;
    const colorScale: PropTypes.Requireable<string>;
    const mode: PropTypes.Requireable<string>;
    const offsetX: PropTypes.Requireable<number>;
    const title: PropTypes.Requireable<string>;
    const yDomain: PropTypes.Requireable<(number | null)[]>;
}
declare namespace defaultProps {
    const className_1: string;
    export { className_1 as className };
    const width_1: number;
    export { width_1 as width };
    const height_1: number;
    export { height_1 as height };
    const bands_1: number;
    export { bands_1 as bands };
    export { DEFAULT_COLORS as colors };
    const colorScale_1: string;
    export { colorScale_1 as colorScale };
    const mode_1: string;
    export { mode_1 as mode };
    const offsetX_1: number;
    export { offsetX_1 as offsetX };
    const title_1: string;
    export { title_1 as title };
    const yDomain_1: undefined;
    export { yDomain_1 as yDomain };
}
import PropTypes from "prop-types";
//# sourceMappingURL=HorizonRow.d.ts.map