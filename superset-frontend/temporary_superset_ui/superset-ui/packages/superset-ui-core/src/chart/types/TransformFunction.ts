import { QueryFormData, QueryContext } from '../..';
import ChartProps from '../models/ChartProps';
import { PlainObject } from './Base';

export type PlainProps = PlainObject;

type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps<Props extends ChartProps = ChartProps> = TransformFunction<Props>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends QueryFormData> = (formData: T) => QueryContext;

export default {};
