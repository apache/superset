import { get } from 'lodash/fp';
import { ChannelDef } from '../types/ChannelDef';
import { isValueDef } from '../typeGuards/ChannelDef';
import { PlainObject } from '../types/Data';
import { Value } from '../types/VegaLite';
import { ChannelInput } from '../types/Channel';

export type Getter<Output extends Value> = (x?: PlainObject) => ChannelInput | Output | undefined;

export default function createGetterFromChannelDef<Output extends Value>(
  definition: ChannelDef<Output>,
): Getter<Output> {
  if (isValueDef(definition)) {
    return () => definition.value;
  } else if (typeof definition.field !== 'undefined') {
    return get(definition.field);
  }

  return () => undefined;
}
