import { RegistryWithDefaultKey } from '@superset-ui/core';
import TimeFormats, { LOCAL_PREFIX } from './TimeFormats';
import createD3TimeFormatter from './factories/createD3TimeFormatter';
import TimeFormatter from './TimeFormatter';

export default class TimeFormatterRegistry extends RegistryWithDefaultKey<
  TimeFormatter,
  TimeFormatter
> {
  constructor() {
    super({
      initialDefaultKey: TimeFormats.DATABASE_DATETIME,
      name: 'TimeFormatter',
    });
  }

  get(format?: string) {
    const targetFormat = `${format || this.defaultKey}`.trim();

    if (this.has(targetFormat)) {
      return super.get(targetFormat) as TimeFormatter;
    }

    // Create new formatter if does not exist
    const useLocalTime = targetFormat.startsWith(LOCAL_PREFIX);
    const formatString = targetFormat.replace(LOCAL_PREFIX, '');
    const formatter = createD3TimeFormatter({ formatString, useLocalTime });
    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(format: string, value: Date | null | undefined): string {
    return this.get(format)(value);
  }
}
