declare class PlaySlider extends React.PureComponent<any, any, any> {
    constructor(props: any);
    intervalMilliseconds: number;
    increment: any;
    onChange(event: any): void;
    play(): void;
    pause(): void;
    stepBackward(): void;
    stepForward(): void;
    getPlayClass(): "fa fa-play fa-lg slider-button" | "fa fa-pause fa-lg slider-button";
    formatter(values: any): any;
}
declare namespace PlaySlider {
    export { propTypes };
    export { defaultProps };
}
export default PlaySlider;
import React from "react";
declare namespace propTypes {
    const start: PropTypes.Validator<number>;
    const step: PropTypes.Validator<number>;
    const end: PropTypes.Validator<number>;
    const values: PropTypes.Validator<any[]>;
    const onChange: PropTypes.Requireable<(...args: any[]) => any>;
    const loopDuration: PropTypes.Requireable<number>;
    const maxFrames: PropTypes.Requireable<number>;
    const orientation: PropTypes.Requireable<string>;
    const reversed: PropTypes.Requireable<boolean>;
    const disabled: PropTypes.Requireable<boolean>;
    const range: PropTypes.Requireable<boolean>;
}
declare namespace defaultProps {
    export function onChange_1(): void;
    export { onChange_1 as onChange };
    const loopDuration_1: number;
    export { loopDuration_1 as loopDuration };
    const maxFrames_1: number;
    export { maxFrames_1 as maxFrames };
    const orientation_1: string;
    export { orientation_1 as orientation };
    const reversed_1: boolean;
    export { reversed_1 as reversed };
    const disabled_1: boolean;
    export { disabled_1 as disabled };
    const range_1: boolean;
    export { range_1 as range };
}
import PropTypes from "prop-types";
//# sourceMappingURL=PlaySlider.d.ts.map