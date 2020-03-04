import { RegistryWithDefaultKey, OverwritePolicy } from '@superset-ui/core';
import createD3NumberFormatter from './factories/createD3NumberFormatter';
import createSmartNumberFormatter from './factories/createSmartNumberFormatter';
import NumberFormats from './NumberFormats';
import NumberFormatter from './NumberFormatter';

export default class NumberFormatterRegistry extends RegistryWithDefaultKey<
  NumberFormatter,
  NumberFormatter
> {
  constructor() {
    super({
      name: 'NumberFormatter',
      overwritePolicy: OverwritePolicy.WARN,
    });

    this.registerValue(NumberFormats.SMART_NUMBER, createSmartNumberFormatter());
    this.registerValue(
      NumberFormats.SMART_NUMBER_SIGNED,
      createSmartNumberFormatter({ signed: true }),
    );
    this.setDefaultKey(NumberFormats.SMART_NUMBER);
  }

  get(formatterId?: string) {
    const targetFormat = `${
      formatterId === null || typeof formatterId === 'undefined' || formatterId === ''
        ? this.defaultKey
        : formatterId
    }`.trim();

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

  format(formatterId: string | undefined, value: number | null | undefined): string {
    return this.get(formatterId)(value);
  }
}
