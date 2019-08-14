import { TimeFormatter } from '@superset-ui/time-format';
import { NumberFormatter } from '@superset-ui/number-format';
import { ValueDef, Value, Type } from './VegaLite';
import { WithScale } from './Scale';
import { WithXAxis, WithYAxis, WithAxis } from './Axis';
import { WithLegend } from './Legend';

export type Formatter = NumberFormatter | TimeFormatter | ((d: any) => string);

export interface FieldDef {
  field: string;
  format?: string;
  title?: string;
}

export interface TypedFieldDef extends FieldDef {
  type: Type;
}

export type TextFieldDef = FieldDef;

export type ScaleFieldDef<Output extends Value = Value> = TypedFieldDef & WithScale<Output>;

export type MarkPropFieldDef<Output extends Value = Value> = ScaleFieldDef<Output> & WithLegend;

// PositionFieldDef is { field: 'fieldName', scale: xxx, axis: xxx }

type PositionFieldDefBase<Output extends Value = Value> = ScaleFieldDef<Output>;

export type XFieldDef<Output extends Value = Value> = PositionFieldDefBase<Output> & WithXAxis;

export type YFieldDef<Output extends Value = Value> = PositionFieldDefBase<Output> & WithYAxis;

export type PositionFieldDef<Output extends Value = Value> = ScaleFieldDef<Output> & WithAxis;

export type MarkPropChannelDef<Output extends Value = Value> =
  | MarkPropFieldDef<Output>
  | ValueDef<Output>;

export type TextChannelDef<Output extends Value = Value> = TextFieldDef | ValueDef<Output>;

export type ChannelDef<Output extends Value = Value> =
  | ValueDef<Output>
  | XFieldDef<Output>
  | YFieldDef<Output>
  | MarkPropFieldDef<Output>
  | TextFieldDef;

/** Channel definitions that are not constant value */
export type NonValueDef<Output extends Value = Value> = Exclude<
  ChannelDef<Output>,
  ValueDef<Output>
>;

/** Pattern for extracting output type from channel definition */
export type ExtractChannelOutput<Def> = Def extends ChannelDef<infer Output> ? Output : never;
