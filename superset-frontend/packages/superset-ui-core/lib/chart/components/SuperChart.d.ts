import React, { ReactNode, RefObject } from 'react';
import { ErrorBoundaryProps, FallbackProps } from 'react-error-boundary';
import { Dimension } from '../../dimension';
import SuperChartCore, { Props as SuperChartCoreProps } from './SuperChartCore';
import DefaultFallbackComponent from './FallbackComponent';
import { ChartPropsConfig } from '../models/ChartProps';
export declare type FallbackPropsWithDimension = FallbackProps & Partial<Dimension>;
export declare type WrapperProps = Dimension & {
    children: ReactNode;
};
export declare type Props = Omit<SuperChartCoreProps, 'chartProps'> & Omit<ChartPropsConfig, 'width' | 'height'> & {
    /**
     * Set this to true to disable error boundary built-in in SuperChart
     * and let the error propagate to upper level
     * and handle by yourself
     */
    disableErrorBoundary?: boolean;
    /** debounceTime to check for container resize */
    debounceTime?: number;
    /** enable "No Results" message if empty result set */
    enableNoResults?: boolean;
    /** Component to render when there are unexpected errors */
    FallbackComponent?: React.ComponentType<FallbackPropsWithDimension>;
    /** Event listener for unexpected errors from chart */
    onErrorBoundary?: ErrorBoundaryProps['onError'];
    /** Prop for form plugins uisng superchart */
    showOverflow?: boolean;
    /** Prop for popovercontainer ref */
    parentRef?: RefObject<any>;
    /** Chart width */
    height?: number | string;
    /** Chart height */
    width?: number | string;
    /**
     * Component to wrap the actual chart
     * after the dynamic width and height are determined.
     * This can be useful for handling tooltip z-index, etc.
     * e.g. <div style={{ position: 'fixed' }} />
     * You cannot just wrap this same component outside of SuperChart
     * when using dynamic width or height
     * because it will clash with auto-sizing.
     */
    Wrapper?: React.ComponentType<WrapperProps>;
};
export default class SuperChart extends React.PureComponent<Props, {}> {
    /**
     * SuperChart's core
     */
    core?: SuperChartCore | null;
    private createChartProps;
    private parseDimension;
    static defaultProps: {
        FallbackComponent: typeof DefaultFallbackComponent;
        height: string | number;
        width: string | number;
        enableNoResults: boolean;
    };
    private setRef;
    renderChart(width: number, height: number): JSX.Element;
    render(): JSX.Element;
}
//# sourceMappingURL=SuperChart.d.ts.map