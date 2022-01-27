export const dataPropType: PropTypes.Requireable<(PropTypes.InferProps<{
    group: PropTypes.Requireable<(string | null)[]>;
    values: PropTypes.Requireable<(PropTypes.InferProps<{
        x: PropTypes.Requireable<number>;
        y: PropTypes.Requireable<number>;
    }> | null)[]>;
}> | null)[]>;
export default TTestTable;
import PropTypes from "prop-types";
declare class TTestTable extends React.Component<any, any, any> {
    constructor(props: any);
    getLiftStatus(row: any): "control" | "invalid" | "true" | "false";
    getPValueStatus(row: any): "control" | "invalid" | "";
    getSignificance(row: any): boolean | "control";
    computeLift(values: any, control: any): string;
    computePValue(values: any, control: any): string | number;
    computeTTest(control: any): void;
}
declare namespace TTestTable {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const alpha: PropTypes.Requireable<number>;
    const data: PropTypes.Validator<(PropTypes.InferProps<{
        group: PropTypes.Requireable<(string | null)[]>;
        values: PropTypes.Requireable<(PropTypes.InferProps<{
            x: PropTypes.Requireable<number>;
            y: PropTypes.Requireable<number>;
        }> | null)[]>;
    }> | null)[]>;
    const groups: PropTypes.Validator<(string | null)[]>;
    const liftValPrec: PropTypes.Requireable<number>;
    const metric: PropTypes.Validator<string>;
    const pValPrec: PropTypes.Requireable<number>;
}
declare namespace defaultProps {
    const alpha_1: number;
    export { alpha_1 as alpha };
    const liftValPrec_1: number;
    export { liftValPrec_1 as liftValPrec };
    const pValPrec_1: number;
    export { pValPrec_1 as pValPrec };
}
//# sourceMappingURL=TTestTable.d.ts.map