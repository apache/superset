import { QueryFormData, QueryContext, SetDataMaskHook, JsonObject } from '../..';
import ChartProps from '../models/ChartProps';
import { PlainObject } from './Base';
export declare type PlainProps = PlainObject;
declare type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;
export declare type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export declare type TransformProps<Props extends ChartProps = ChartProps> = TransformFunction<Props>;
export declare type PostTransformProps = TransformFunction;
export declare type BuildQueryFunction<T extends QueryFormData> = (formData: T, options?: {
    extras?: {
        cachedChanges?: any;
    };
    ownState?: JsonObject;
    hooks?: {
        setDataMask: SetDataMaskHook;
        setCachedChanges: (newChanges: any) => void;
    };
}) => QueryContext;
declare const _default: {};
export default _default;
//# sourceMappingURL=TransformFunction.d.ts.map