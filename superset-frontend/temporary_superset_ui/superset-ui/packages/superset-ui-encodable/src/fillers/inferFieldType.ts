import { ChannelType } from '../types/Channel';
import { isXOrY } from '../typeGuards/Channel';
import { Type } from '../types/VegaLite';

const temporalFieldNames = new Set(['time', 'date', 'datetime', 'timestamp']);

export default function inferFieldType(channelType: ChannelType, field: string = ''): Type {
  if (isXOrY(channelType) || channelType === 'Numeric') {
    return temporalFieldNames.has(field.toLowerCase()) ? 'temporal' : 'quantitative';
  }

  return 'nominal';
}
