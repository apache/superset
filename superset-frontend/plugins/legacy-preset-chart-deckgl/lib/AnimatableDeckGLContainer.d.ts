declare class AnimatableDeckGLContainer extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
    containerRef: React.RefObject<any>;
    setTooltip: (tooltip: any) => void;
}
declare namespace AnimatableDeckGLContainer {
    export { propTypes };
    export { defaultProps };
}
export default AnimatableDeckGLContainer;
import React from "react";
declare namespace propTypes {
    const getLayers: PropTypes.Validator<(...args: any[]) => any>;
    const start: PropTypes.Validator<number>;
    const end: PropTypes.Validator<number>;
    const getStep: PropTypes.Requireable<(...args: any[]) => any>;
    const values: PropTypes.Validator<any[]>;
    const aggregation: PropTypes.Requireable<boolean>;
    const disabled: PropTypes.Requireable<boolean>;
    const viewport: PropTypes.Validator<object>;
    const children: PropTypes.Requireable<PropTypes.ReactNodeLike>;
    const mapStyle: PropTypes.Requireable<string>;
    const mapboxApiAccessToken: PropTypes.Validator<string>;
    const setControlValue: PropTypes.Requireable<(...args: any[]) => any>;
    const onValuesChange: PropTypes.Requireable<(...args: any[]) => any>;
    const width: PropTypes.Validator<number>;
    const height: PropTypes.Validator<number>;
}
declare namespace defaultProps {
    const aggregation_1: boolean;
    export { aggregation_1 as aggregation };
    const disabled_1: boolean;
    export { disabled_1 as disabled };
    const mapStyle_1: string;
    export { mapStyle_1 as mapStyle };
    export function setControlValue_1(): void;
    export { setControlValue_1 as setControlValue };
    export function onValuesChange_1(): void;
    export { onValuesChange_1 as onValuesChange };
}
import PropTypes from "prop-types";
//# sourceMappingURL=AnimatableDeckGLContainer.d.ts.map