import { QueryFormData, QueryContext } from '@superset-ui/query';
import ChartProps from '../models/ChartProps';

export interface PlainProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps = TransformFunction<ChartProps>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends QueryFormData> = (formData: T) => QueryContext;
