import { get } from 'lodash/fp';
import { isValueDef, ChannelDef } from '../types/FieldDef';
import identity from '../utils/identity';

export default function extractGetter(definition: ChannelDef) {
  if (isValueDef(definition)) {
    return () => definition.value;
  } else if ('field' in definition && definition.field !== undefined) {
    return get(definition.field);
  }

  return identity;
}
