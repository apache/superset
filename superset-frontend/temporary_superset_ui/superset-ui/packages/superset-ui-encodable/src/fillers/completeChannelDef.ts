import { ChannelDef, NonValueDef } from '../types/ChannelDef';
import { ChannelType } from '../types/Channel';
import { isFieldDef, isValueDef, isTypedFieldDef } from '../typeGuards/ChannelDef';
import completeAxisConfig, { CompleteAxisConfig } from './completeAxisConfig';
import completeScaleConfig, { CompleteScaleConfig } from './completeScaleConfig';
import { Value, ValueDef, Type } from '../types/VegaLite';
import inferFieldType from './inferFieldType';

export interface CompleteValueDef<Output extends Value = Value> extends ValueDef<Output> {
  axis: false;
  scale: false;
  title: '';
}

export type CompleteFieldDef<Output extends Value = Value> = Omit<
  NonValueDef<Output>,
  'title' | 'axis' | 'scale'
> & {
  type: Type;
  axis: CompleteAxisConfig;
  scale: CompleteScaleConfig<Output>;
  title: string;
};

export type CompleteChannelDef<Output extends Value = Value> =
  | CompleteValueDef<Output>
  | CompleteFieldDef<Output>;

export default function completeChannelDef<Output extends Value>(
  channelType: ChannelType,
  channelDef: ChannelDef<Output>,
): CompleteChannelDef<Output> {
  if (isValueDef(channelDef)) {
    return {
      ...channelDef,
      axis: false,
      scale: false,
      title: '',
    };
  }

  // Fill top-level properties
  const copy = {
    ...channelDef,
    title: isFieldDef(channelDef) ? channelDef.title || channelDef.field : '',
    type: isTypedFieldDef(channelDef)
      ? channelDef.type
      : inferFieldType(channelType, channelDef.field),
  };

  return {
    ...copy,
    axis: completeAxisConfig(channelType, copy),
    scale: completeScaleConfig(channelType, copy),
  };
}
