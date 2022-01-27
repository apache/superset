export default PairedTTest;
declare class PairedTTest extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
}
declare namespace PairedTTest {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const alpha: PropTypes.Requireable<number>;
    const className: PropTypes.Requireable<string>;
    const data: PropTypes.Validator<{
        [x: string]: (PropTypes.InferProps<{
            group: PropTypes.Requireable<(string | null)[]>;
            values: PropTypes.Requireable<(PropTypes.InferProps<{
                x: PropTypes.Requireable<number>;
                y: PropTypes.Requireable<number>;
            }> | null)[]>;
        }> | null)[] | null;
    }>;
    const groups: PropTypes.Validator<(string | null)[]>;
    const liftValPrec: PropTypes.Requireable<number>;
    const metrics: PropTypes.Validator<(string | null)[]>;
    const pValPrec: PropTypes.Requireable<number>;
}
declare namespace defaultProps {
    const alpha_1: number;
    export { alpha_1 as alpha };
    const className_1: string;
    export { className_1 as className };
    const liftValPrec_1: number;
    export { liftValPrec_1 as liftValPrec };
    const pValPrec_1: number;
    export { pValPrec_1 as pValPrec };
}
import PropTypes from "prop-types";
//# sourceMappingURL=PairedTTest.d.ts.map