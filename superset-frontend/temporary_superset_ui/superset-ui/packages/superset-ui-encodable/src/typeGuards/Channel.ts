import { ChannelType } from '../types/Channel';

export function isX(channelType: ChannelType): channelType is 'X' | 'XBand' {
  return channelType === 'X' || channelType === 'XBand';
}

export function isY(channelType: ChannelType): channelType is 'Y' | 'YBand' {
  return channelType === 'Y' || channelType === 'YBand';
}

export function isXOrY(channelType: ChannelType): channelType is 'X' | 'XBand' | 'Y' | 'YBand' {
  return isX(channelType) || isY(channelType);
}
