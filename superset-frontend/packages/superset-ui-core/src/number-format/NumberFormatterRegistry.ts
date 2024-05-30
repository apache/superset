// DODO was here

import {
  FormatLocaleDefinition,
  formatLocale,
  precisionFixed,
  format,
} from 'd3-format';
import { RegistryWithDefaultKey, OverwritePolicy } from '../models';
import {
  DEFAULT_D3_FORMAT,
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
  d3Format: FormatLocaleDefinition;

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
            let roundedPostfix = ''; // DODO added #34205508
            // we need a rounded value for locale Russia
            if (localeName === 'RUSSIAN_ROUNDED') {
              const preFormatFunction = format(`.${precisionFixed(1)}f`);
              // @ts-ignore
              value = preFormatFunction(v);
            }
            if (localeName === 'DEFAULT_ROUNDED') {
              const preFormatFunction = format(`.${precisionFixed(1)}f`);
              // @ts-ignore
              value = preFormatFunction(v);
            }
            if (localeName === 'RUSSIAN_ROUNDED_1') {
              // @ts-ignore
              value = v.toFixed(1);
              // DODO added #34205508
              roundedPostfix = '.1f';
            }
            if (localeName === 'RUSSIAN_ROUNDED_2') {
              // @ts-ignore
              value = v.toFixed(2);
              // DODO added #34205508
              roundedPostfix = '.2f';
            }
            if (localeName === 'RUSSIAN_ROUNDED_3') {
              // @ts-ignore
              value = v.toFixed(3);
              // DODO added #34205508
              roundedPostfix = '.3f';
            }

            const locale = formatLocale(D3_CURRENCIES_LOCALES[localeName]);
            return locale.format(`$,${roundedPostfix}`)(value); // DODO added roundedPostfix #34205508  https://d3js.org/d3-format#locale_format
          },
        }),
      );
    });
    this.setDefaultKey(NumberFormats.SMART_NUMBER);
    this.d3Format = DEFAULT_D3_FORMAT;
  }

  setD3Format(d3Format: Partial<FormatLocaleDefinition>) {
    this.d3Format = { ...DEFAULT_D3_FORMAT, ...d3Format };
    return this;
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
      locale: this.d3Format,
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
