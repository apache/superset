import * as React from 'react';
import ChartProps from '../models/ChartProps';
import { PreTransformProps, TransformProps, PostTransformProps } from '../types/TransformFunction';
import { HandlerFunction } from '../types/Base';
declare function IDENTITY<T>(x: T): T;
export declare type Props = {
    id?: string;
    className?: string;
    chartProps?: ChartProps | null;
    chartType: string;
    preTransformProps?: PreTransformProps;
    overrideTransformProps?: TransformProps;
    postTransformProps?: PostTransformProps;
    onRenderSuccess?: HandlerFunction;
    onRenderFailure?: HandlerFunction;
};
export default class SuperChartCore extends React.PureComponent<Props, {}> {
    /**
     * The HTML element that wraps all chart content
     */
    container?: HTMLElement | null;
    /**
     * memoized function so it will not recompute
     * and return previous value
     * unless one of
     * - preTransformProps
     * - transformProps
     * - postTransformProps
     * - chartProps
     * is changed.
     */
    processChartProps: import("reselect").OutputSelector<{
        chartProps: ChartProps;
        preTransformProps?: PreTransformProps | undefined;
        transformProps?: TransformProps<ChartProps<import("../types/Base").PlainObject>> | undefined;
        postTransformProps?: PostTransformProps | undefined;
    }, import("../types/Base").PlainObject, (res1: ChartProps<import("../types/Base").PlainObject>, res2: PreTransformProps | undefined, res3: TransformProps<ChartProps<import("../types/Base").PlainObject>> | undefined, res4: PostTransformProps | undefined) => import("../types/Base").PlainObject>;
    /**
     * memoized function so it will not recompute
     * and return previous value
     * unless one of
     * - chartType
     * - overrideTransformProps
     * is changed.
     */
    private createLoadableRenderer;
    static defaultProps: {
        id: string;
        className: string;
        preTransformProps: typeof IDENTITY;
        overrideTransformProps: undefined;
        postTransformProps: typeof IDENTITY;
        onRenderSuccess(): void;
        onRenderFailure(): void;
    };
    private renderChart;
    private renderLoading;
    private setRef;
    render(): JSX.Element | null;
}
export {};
//# sourceMappingURL=SuperChartCore.d.ts.map