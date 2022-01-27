declare class Legend extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
    format(value: any): any;
    formatCategoryLabel(k: any): any;
}
declare namespace Legend {
    export { propTypes };
    export { defaultProps };
}
export default Legend;
import React from "react";
declare namespace propTypes {
    const categories: PropTypes.Requireable<object>;
    const forceCategorical: PropTypes.Requireable<boolean>;
    const format: PropTypes.Requireable<string>;
    const position: PropTypes.Requireable<string | null>;
    const showSingleCategory: PropTypes.Requireable<(...args: any[]) => any>;
    const toggleCategory: PropTypes.Requireable<(...args: any[]) => any>;
}
declare namespace defaultProps {
    const categories_1: {};
    export { categories_1 as categories };
    const forceCategorical_1: boolean;
    export { forceCategorical_1 as forceCategorical };
    const format_1: null;
    export { format_1 as format };
    const position_1: string;
    export { position_1 as position };
    export function showSingleCategory_1(): void;
    export { showSingleCategory_1 as showSingleCategory };
    export function toggleCategory_1(): void;
    export { toggleCategory_1 as toggleCategory };
}
import PropTypes from "prop-types";
//# sourceMappingURL=Legend.d.ts.map