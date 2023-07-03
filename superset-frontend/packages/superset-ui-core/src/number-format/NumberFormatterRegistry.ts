// DODO was here
import { formatLocale, precisionFixed, format } from 'd3-format';
import { RegistryWithDefaultKey, OverwritePolicy } from '../models';
import {
  D3_CURRENCIES_LOCALES,
  SUPPORTED_CURRENCIES_LOCALES_ARRAY,
} from './D3FormatConfig';
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

    this.registerValue(
      NumberFormats.SMART_NUMBER,
      createSmartNumberFormatter(),
    );

    this.registerValue(
      NumberFormats.SMART_NUMBER_SIGNED,
      createSmartNumberFormatter({ signed: true }),
    );

    SUPPORTED_CURRENCIES_LOCALES_ARRAY.forEach(localeName => {
      this.registerValue(
        D3_CURRENCIES_LOCALES[localeName].id,
        new NumberFormatter({
          id: D3_CURRENCIES_LOCALES[localeName].id,
          formatFunc: v => {
            let value = v;
            // we need a rounded value for locale Russia
            if (localeName === 'RUS_2f_ROUNDED') {
              const preFormatFunction = format(`.${precisionFixed(1)}f`);
              // @ts-ignore
              value = preFormatFunction(v);
            }
            const locale = formatLocale(D3_CURRENCIES_LOCALES[localeName]);
            return locale.format('$,')(value);
          },
        }),
      );
    });

    this.setDefaultKey(NumberFormats.SMART_NUMBER);
  }

  get(formatterId?: string) {
    const targetFormat = `${
      formatterId === null ||
      typeof formatterId === 'undefined' ||
      formatterId === ''
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

  format(
    formatterId: string | undefined,
    value: number | null | undefined,
  ): string {
    return this.get(formatterId)(value);
  }
}
