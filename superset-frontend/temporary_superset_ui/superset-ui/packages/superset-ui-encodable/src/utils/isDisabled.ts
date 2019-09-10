import { PropertyValue } from '../types/ChannelDef';

export default function isDisabled(config: PropertyValue): config is false | null {
  return config === false || config === null;
}
