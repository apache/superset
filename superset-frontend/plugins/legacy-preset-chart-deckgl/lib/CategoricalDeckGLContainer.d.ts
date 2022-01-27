declare class CategoricalDeckGLContainer extends React.PureComponent<any, any, any> {
    constructor(props: any);
    containerRef: React.RefObject<any>;
    getLayers(values: any): any[];
    onValuesChange(values: any): void;
    toggleCategory(category: any): void;
    showSingleCategory(category: any): void;
    getStateFromProps(props: any, state: any): any;
    addColor(data: any, fd: any): any;
    setTooltip: (tooltip: any) => void;
}
declare namespace CategoricalDeckGLContainer {
    export { propTypes };
}
export default CategoricalDeckGLContainer;
import React from "react";
declare namespace propTypes {
    const datasource: PropTypes.Validator<object>;
    const formData: PropTypes.Validator<object>;
    const getLayer: PropTypes.Validator<(...args: any[]) => any>;
    const getPoints: PropTypes.Validator<(...args: any[]) => any>;
    const height: PropTypes.Validator<number>;
    const mapboxApiKey: PropTypes.Validator<string>;
    const onAddFilter: PropTypes.Requireable<(...args: any[]) => any>;
    const payload: PropTypes.Validator<object>;
    const setControlValue: PropTypes.Validator<(...args: any[]) => any>;
    const viewport: PropTypes.Validator<object>;
    const width: PropTypes.Validator<number>;
}
import PropTypes from "prop-types";
//# sourceMappingURL=CategoricalDeckGLContainer.d.ts.map