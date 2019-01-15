import { RegistryWithDefaultKey } from '@superset-ui/core';
import createD3NumberFormatter from './factories/createD3NumberFormatter';
import NumberFormats from './NumberFormats';
import NumberFormatter from './NumberFormatter';

export default class NumberFormatterRegistry extends RegistryWithDefaultKey<
  NumberFormatter,
  NumberFormatter
> {
  constructor() {
    super({
      initialDefaultKey: NumberFormats.SI,
      name: 'NumberFormatter',
    });
  }

  get(formatterId?: string) {
    const targetFormat = `${formatterId || this.defaultKey}`.trim();

    if (this.has(targetFormat)) {
      return super.get(targetFormat) as NumberFormatter;
    }

    // Create new formatter if does not exist
    const formatter = createD3NumberFormatter({
      formatString: targetFormat,
    });
    this.registerValue(targetFormat, formatter);

    return formatter;
  }

  format(formatterId: string, value: number | null | undefined): string {
    return this.get(formatterId)(value);
  }
}
