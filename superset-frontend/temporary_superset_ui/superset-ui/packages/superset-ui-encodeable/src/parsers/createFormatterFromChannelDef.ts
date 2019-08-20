import { ChannelDef } from '../types/ChannelDef';
import { isTypedFieldDef } from '../typeGuards/ChannelDef';
import fallbackFormatter from './fallbackFormatter';
import createFormatterFromFieldTypeAndFormat from './createFormatterFromFieldTypeAndFormat';

export default function createFormatterFromChannelDef(definition: ChannelDef) {
  if (isTypedFieldDef(definition)) {
    const { type, format = '' } = definition;

    return createFormatterFromFieldTypeAndFormat(type, format);
  }

  return fallbackFormatter;
}
