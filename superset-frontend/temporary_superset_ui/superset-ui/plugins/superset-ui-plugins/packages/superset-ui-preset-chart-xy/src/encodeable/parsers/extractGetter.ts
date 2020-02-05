import { get } from 'lodash/fp';
import { isValueDef, ChannelDef } from '../types/ChannelDef';
import identity from '../utils/identity';

export default function extractGetter(definition: ChannelDef) {
  if (isValueDef(definition)) {
    return () => definition.value;
  }
  if ('field' in definition && definition.field !== undefined) {
    return get(definition.field);
  }

  return identity;
}
