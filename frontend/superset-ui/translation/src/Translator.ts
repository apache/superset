import UntypedJed from 'jed';
import { TranslatorConfig } from './types';

interface Jed {
  translate(input: string): Jed;
  ifPlural(value: number, plural: string): Jed;
  fetch(...args: any[]): string;
}

const DEFAULT_LANGUAGE_PACK = {
  domain: 'superset',
  locale_data: {
    superset: {
      '': {
        domain: 'superset',
        lang: 'en',
        plural_forms: 'nplurals=1; plural=0',
      },
    },
  },
};

export default class Translator {
  i18n: Jed;

  constructor(config: TranslatorConfig = {}) {
    const { languagePack = DEFAULT_LANGUAGE_PACK } = config;
    this.i18n = new UntypedJed(languagePack) as Jed;
  }

  translate(input: string, ...args: any[]): string {
    return this.i18n.translate(input).fetch(...args);
  }

  translateWithNumber(singular: string, plural: string, num: number = 0, ...args: any[]): string {
    return this.i18n
      .translate(singular)
      .ifPlural(num, plural)
      .fetch(...args);
  }
}
