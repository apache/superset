export function getLayer(formData: any, payload: any, onAddFilter: any, setTooltip: any, selected: any, onSelect: any, filters: any): any;
export default DeckGLPolygon;
declare class DeckGLPolygon extends React.Component<any, any, any> {
    static getDerivedStateFromProps(props: any, state: any): {
        start: number;
        end: number;
        getStep: any;
        values: number[];
        disabled: any;
        viewport: any;
        selected: never[];
        lastClick: number;
        formData: any;
    } | null;
    constructor(props: any);
    containerRef: React.RefObject<any>;
    getLayers(values: any): any[];
    onSelect(polygon: any): void;
    onValuesChange(values: any): void;
    setTooltip: (tooltip: any) => void;
}
declare namespace DeckGLPolygon {
    export { propTypes };
    export { defaultProps };
}
import React from "react";
declare namespace propTypes {
    const formData: PropTypes.Validator<object>;
    const payload: PropTypes.Validator<object>;
    const setControlValue: PropTypes.Validator<(...args: any[]) => any>;
    const viewport: PropTypes.Validator<object>;
    const onAddFilter: PropTypes.Requireable<(...args: any[]) => any>;
    const width: PropTypes.Validator<number>;
    const height: PropTypes.Validator<number>;
}
declare namespace defaultProps {
    function onAddFilter(): void;
    function onAddFilter(): void;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Polygon.d.ts.map