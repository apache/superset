import { RegistryWithDefaultKey } from '@superset-ui/core';
import TimeFormats, { LOCAL_PREFIX } from './TimeFormats';
import createD3TimeFormatter from './factories/createD3TimeFormatter';

export default class TimeFormatterRegistry extends RegistryWithDefaultKey {
  constructor() {
    super({
      initialDefaultKey: TimeFormats.DATABASE_DATETIME,
      name: 'TimeFormatter',
    });
  }

  get(format) {
    const targetFormat = format || this.defaultKey;

    if (this.has(targetFormat)) {
      return super.get(targetFormat);
    }

    // Create new formatter if does not exist
    const useLocalTime = targetFormat.startsWith(LOCAL_PREFIX);
    const formatString = targetFormat.replace(LOCAL_PREFIX, '');
    const formatter = createD3TimeFormatter({ formatString, useLocalTime });
    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(format, value) {
    return this.get(format)(value);
  }
}
