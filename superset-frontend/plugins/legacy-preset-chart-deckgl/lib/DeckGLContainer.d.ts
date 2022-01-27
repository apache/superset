export class DeckGLContainer extends React.Component<any, any, any> {
    constructor(props: any);
    tick(): void;
    onViewStateChange({ viewState }: {
        viewState: any;
    }): void;
    layers(): any;
    setTooltip: (tooltip: any) => void;
}
export namespace DeckGLContainer {
    export { propTypes };
    export { defaultProps };
}
export const DeckGLContainerStyledWrapper: import("@emotion/styled").StyledComponent<Pick<PropTypes.InferProps<{
    viewport: PropTypes.Validator<object>;
    layers: PropTypes.Validator<any[]>;
    setControlValue: PropTypes.Requireable<(...args: any[]) => any>;
    mapStyle: PropTypes.Requireable<string>;
    mapboxApiAccessToken: PropTypes.Validator<string>;
    children: PropTypes.Requireable<PropTypes.ReactNodeLike>;
    bottomMargin: PropTypes.Requireable<number>;
    width: PropTypes.Validator<number>;
    height: PropTypes.Validator<number>;
    onViewportChange: PropTypes.Requireable<(...args: any[]) => any>;
}>, "onViewportChange" | PropTypes.RequiredKeys<{
    viewport: PropTypes.Validator<object>;
    layers: PropTypes.Validator<any[]>;
    setControlValue: PropTypes.Requireable<(...args: any[]) => any>;
    mapStyle: PropTypes.Requireable<string>;
    mapboxApiAccessToken: PropTypes.Validator<string>;
    children: PropTypes.Requireable<PropTypes.ReactNodeLike>;
    bottomMargin: PropTypes.Requireable<number>;
    width: PropTypes.Validator<number>;
    height: PropTypes.Validator<number>;
    onViewportChange: PropTypes.Requireable<(...args: any[]) => any>;
}>> & Partial<Pick<PropTypes.InferProps<{
    viewport: PropTypes.Validator<object>;
    layers: PropTypes.Validator<any[]>;
    setControlValue: PropTypes.Requireable<(...args: any[]) => any>;
    mapStyle: PropTypes.Requireable<string>;
    mapboxApiAccessToken: PropTypes.Validator<string>;
    children: PropTypes.Requireable<PropTypes.ReactNodeLike>;
    bottomMargin: PropTypes.Requireable<number>;
    width: PropTypes.Validator<number>;
    height: PropTypes.Validator<number>;
    onViewportChange: PropTypes.Requireable<(...args: any[]) => any>;
}>, "children" | "setControlValue" | "mapStyle" | "bottomMargin">> & Partial<Pick<{
    mapStyle: string;
    setControlValue: () => void;
    children: null;
    bottomMargin: number;
}, never>> & {
    theme?: import("@emotion/react").Theme | undefined;
}, {}, {
    ref?: React.Ref<DeckGLContainer> | undefined;
}>;
import React from "react";
declare namespace propTypes {
    const viewport: PropTypes.Validator<object>;
    const layers: PropTypes.Validator<any[]>;
    const setControlValue: PropTypes.Requireable<(...args: any[]) => any>;
    const mapStyle: PropTypes.Requireable<string>;
    const mapboxApiAccessToken: PropTypes.Validator<string>;
    const children: PropTypes.Requireable<PropTypes.ReactNodeLike>;
    const bottomMargin: PropTypes.Requireable<number>;
    const width: PropTypes.Validator<number>;
    const height: PropTypes.Validator<number>;
    const onViewportChange: PropTypes.Requireable<(...args: any[]) => any>;
}
declare namespace defaultProps {
    const mapStyle_1: string;
    export { mapStyle_1 as mapStyle };
    export function setControlValue_1(): void;
    export { setControlValue_1 as setControlValue };
    const children_1: null;
    export { children_1 as children };
    const bottomMargin_1: number;
    export { bottomMargin_1 as bottomMargin };
}
import PropTypes from "prop-types";
export {};
//# sourceMappingURL=DeckGLContainer.d.ts.map