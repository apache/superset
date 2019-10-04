import { Value } from '../types/VegaLite';
import { Legend } from '../types/Legend';
import { ChannelType } from '../types/Channel';
import { ChannelDef } from '../types/ChannelDef';
import { isXOrY } from '../typeGuards/Channel';

export type CompleteLegendConfig = false | Legend;

export default function completeLegendConfig<Output extends Value = Value>(
  channelType: ChannelType,
  channelDef: ChannelDef<Output>,
): CompleteLegendConfig {
  if ('legend' in channelDef && channelDef.legend !== undefined) {
    return channelDef.legend;
  }

  return isXOrY(channelType) ? false : {};
}
