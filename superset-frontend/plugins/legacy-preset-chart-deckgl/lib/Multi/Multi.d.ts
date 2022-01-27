export default DeckMulti;
declare class DeckMulti extends React.PureComponent<any, any, any> {
    constructor(props: any);
    containerRef: React.RefObject<any>;
    onViewportChange(viewport: any): void;
    loadLayers(formData: any, payload: any, viewport: any): void;
    setTooltip: (tooltip: any) => void;
}
declare namespace DeckMulti {
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
    const onSelect: PropTypes.Requireable<(...args: any[]) => any>;
}
declare namespace defaultProps {
    function onAddFilter(): void;
    function onAddFilter(): void;
    function onSelect(): void;
    function onSelect(): void;
}
import PropTypes from "prop-types";
//# sourceMappingURL=Multi.d.ts.map