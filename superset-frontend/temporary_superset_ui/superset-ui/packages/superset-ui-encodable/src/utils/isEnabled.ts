import isDisabled from './isDisabled';
import { PropertyValue } from '../types/ChannelDef';

export default function isEnabled(
  config: PropertyValue,
): config is Exclude<PropertyValue, false | null> {
  return !isDisabled(config);
}
