import { ComponentType } from 'react';
import { Plugin, QueryFormData } from '../..';
import ChartMetadata from './ChartMetadata';
import { BuildQueryFunction, TransformProps } from '../types/TransformFunction';
import { ChartControlPanel } from './ChartControlPanel';
import { ChartProps } from '..';
export declare type PromiseOrValue<T> = Promise<T> | T;
export declare type PromiseOrValueLoader<T> = () => PromiseOrValue<T>;
export declare type ChartType = ComponentType<any>;
declare type ValueOrModuleWithValue<T> = T | {
    default: T;
};
interface ChartPluginConfig<FormData extends QueryFormData = QueryFormData, Props extends ChartProps = ChartProps> {
    metadata: ChartMetadata;
    /** Use buildQuery for immediate value. For lazy-loading, use loadBuildQuery. */
    buildQuery?: BuildQueryFunction<FormData>;
    /** Use loadBuildQuery for dynamic import (lazy-loading) */
    loadBuildQuery?: PromiseOrValueLoader<ValueOrModuleWithValue<BuildQueryFunction<FormData>>>;
    /** Use transformProps for immediate value. For lazy-loading, use loadTransformProps.  */
    transformProps?: TransformProps<Props>;
    /** Use loadTransformProps for dynamic import (lazy-loading) */
    loadTransformProps?: PromiseOrValueLoader<ValueOrModuleWithValue<TransformProps<Props>>>;
    /** Use Chart for immediate value. For lazy-loading, use loadChart. */
    Chart?: ChartType;
    /** Use loadChart for dynamic import (lazy-loading) */
    loadChart?: PromiseOrValueLoader<ValueOrModuleWithValue<ChartType>>;
    /** Control panel configuration object */
    controlPanel?: ChartControlPanel;
}
export default class ChartPlugin<FormData extends QueryFormData = QueryFormData, Props extends ChartProps = ChartProps> extends Plugin {
    controlPanel: ChartControlPanel;
    metadata: ChartMetadata;
    loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<FormData>>;
    loadTransformProps: PromiseOrValueLoader<TransformProps<Props>>;
    loadChart: PromiseOrValueLoader<ChartType>;
    constructor(config: ChartPluginConfig<FormData, Props>);
    register(): this;
    unregister(): this;
    configure(config: {
        [key: string]: unknown;
    }, replace?: boolean): this;
}
export {};
//# sourceMappingURL=ChartPlugin.d.ts.map