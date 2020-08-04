import { QueryFormData, QueryContext } from '@superset-ui/query';
import ChartProps from '../models/ChartProps';
export interface PlainProps {
    [key: string]: any;
}
declare type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;
export declare type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export declare type TransformProps = TransformFunction<ChartProps>;
export declare type PostTransformProps = TransformFunction;
export declare type BuildQueryFunction<T extends QueryFormData> = (formData: T) => QueryContext;
export {};
//# sourceMappingURL=TransformFunction.d.ts.map