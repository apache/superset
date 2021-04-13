import { QueryFormData, QueryContext, SetDataMaskHook, JsonObject } from '../..';
import ChartProps from '../models/ChartProps';
import { PlainObject } from './Base';

export type PlainProps = PlainObject;

type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps<Props extends ChartProps = ChartProps> = TransformFunction<Props>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends QueryFormData> = (
  formData: T,
  options?: {
    extras?: {
      cachedChanges?: any;
    };
    ownState?: JsonObject;
    hooks?: {
      setDataMask: SetDataMaskHook;
      setCachedChanges: (newChanges: any) => void;
    };
  },
) => QueryContext;

export default {};
