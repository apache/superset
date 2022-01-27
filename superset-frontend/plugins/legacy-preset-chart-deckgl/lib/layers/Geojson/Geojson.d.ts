export function getLayer(formData: any, payload: any, onAddFilter: any, setTooltip: any): any;
export default DeckGLGeoJson;
declare class DeckGLGeoJson extends React.Component<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
    containerRef: React.RefObject<any>;
    setTooltip: (tooltip: any) => void;
}
declare namespace DeckGLGeoJson {
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
}
declare namespace defaultProps {
    function onAddFilter(): void;
    function onAddFilter(): void;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Geojson.d.ts.map