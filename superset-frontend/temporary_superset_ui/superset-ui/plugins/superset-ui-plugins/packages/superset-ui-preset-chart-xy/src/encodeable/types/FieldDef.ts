// eslint-disable no-unused-vars
import { ValueDef, Value } from 'vega-lite/build/src/fielddef';
import { Type } from 'vega-lite/build/src/type';
import { TimeFormatter } from '@superset-ui/time-format';
import { NumberFormatter } from '@superset-ui/number-format';
import { WithScale } from './Scale';
import { WithXAxis, WithYAxis, WithAxis } from './Axis';
import { WithLegend } from './Legend';

export type Formatter = NumberFormatter | TimeFormatter | ((d: any) => string);

// ValueDef is { value: xxx }

export interface FieldDef {
  field: string;
  format?: string;
  title?: string;
}

export interface TypedFieldDef extends FieldDef {
  type: Type;
}

export type TextFieldDef = FieldDef;

type ScaleFieldDef<Output extends Value = Value> = TypedFieldDef & WithScale<Output>;

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

export type NonValueDef<Output extends Value = Value> =
  | XFieldDef<Output>
  | YFieldDef<Output>
  | MarkPropFieldDef<Output>
  | TextFieldDef;

export type ChannelDef<Output extends Value = Value> = NonValueDef<Output> | ValueDef<Output>;

export function isValueDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is ValueDef<Output> {
  return channelDef && 'value' in channelDef;
}

export function isNonValueDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is NonValueDef<Output> {
  return channelDef && !('value' in channelDef);
}

export function isFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is FieldDef {
  return channelDef && 'field' in channelDef && !!channelDef.field;
}

export function isTypedFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is TypedFieldDef {
  return isFieldDef(channelDef) && 'type' in channelDef && !!channelDef.type;
}

export function isScaleFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is ScaleFieldDef {
  return channelDef && ('scale' in channelDef || 'sort' in channelDef);
}

export function isMarkPropFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is MarkPropFieldDef {
  return channelDef && 'legend' in channelDef;
}

export function isPositionFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is PositionFieldDef<Output> {
  return channelDef && ('axis' in channelDef || 'stack' in channelDef || 'impute' in channelDef);
}
