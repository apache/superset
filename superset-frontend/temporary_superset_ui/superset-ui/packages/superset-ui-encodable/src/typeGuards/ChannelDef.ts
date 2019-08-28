import { Value, ValueDef } from '../types/VegaLite';
import {
  ChannelDef,
  NonValueDef,
  FieldDef,
  TypedFieldDef,
  PositionFieldDef,
  ScaleFieldDef,
} from '../types/ChannelDef';

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
): channelDef is ScaleFieldDef<Output> {
  return channelDef && 'scale' in channelDef;
}

export function isPositionFieldDef<Output extends Value>(
  channelDef: ChannelDef<Output>,
): channelDef is PositionFieldDef<Output> {
  return channelDef && 'axis' in channelDef;
}
