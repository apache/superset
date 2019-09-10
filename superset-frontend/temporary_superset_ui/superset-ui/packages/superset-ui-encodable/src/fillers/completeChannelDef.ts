import { ChannelDef } from '../types/ChannelDef';
import { ChannelType } from '../types/Channel';
import { isFieldDef } from '../typeGuards/ChannelDef';
import completeAxisConfig, { CompleteAxisConfig } from './completeAxisConfig';
import completeScaleConfig, { CompleteScaleConfig } from './completeScaleConfig';
import { Value } from '../types/VegaLite';

type CompleteChannelDef<Output extends Value = Value> = Omit<
  ChannelDef,
  'title' | 'axis' | 'scale'
> & {
  axis: CompleteAxisConfig;
  scale: CompleteScaleConfig<Output>;
  title: string;
};

export default function completeChannelDef<Output extends Value = Value>(
  channelType: ChannelType,
  channelDef: ChannelDef<Output>,
): CompleteChannelDef<Output> {
  // Fill top-level properties
  const copy = {
    ...channelDef,
    title: isFieldDef(channelDef) ? channelDef.title || channelDef.field : '',
  };

  return {
    ...copy,
    axis: completeAxisConfig(channelType, copy),
    scale: completeScaleConfig(channelType, copy),
  };
}
