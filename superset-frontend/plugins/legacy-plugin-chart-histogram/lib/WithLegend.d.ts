export default WithLegend;
declare class WithLegend extends React.Component<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
    getContainerDirection(): "row" | "row-reverse" | "column-reverse" | "column";
    getLegendJustifyContent(): any;
}
declare namespace WithLegend {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const className: PropTypes.Requireable<string>;
    const width: PropTypes.Requireable<string | number>;
    const height: PropTypes.Requireable<string | number>;
    const renderChart: PropTypes.Validator<(...args: any[]) => any>;
    const renderLegend: PropTypes.Validator<(...args: any[]) => any>;
    const position: PropTypes.Requireable<string>;
    const legendJustifyContent: PropTypes.Requireable<string>;
}
declare namespace defaultProps {
    const className_1: string;
    export { className_1 as className };
    const width_1: string;
    export { width_1 as width };
    const height_1: string;
    export { height_1 as height };
    const position_1: string;
    export { position_1 as position };
    const legendJustifyContent_1: undefined;
    export { legendJustifyContent_1 as legendJustifyContent };
}
import PropTypes from "prop-types";
//# sourceMappingURL=WithLegend.d.ts.map