import { ChartFormData } from './ChartFormData';
import ChartProps from '../models/ChartProps';
import { QueryContext } from './Query';

export interface PlainProps {
  [key: string]: any;
}

type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps = TransformFunction<ChartProps>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends ChartFormData> = (formData: T) => QueryContext;
