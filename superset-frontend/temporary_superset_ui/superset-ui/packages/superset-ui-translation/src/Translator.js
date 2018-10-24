import Jed from 'jed';
import { sprintf } from 'sprintf-js';

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
  constructor({ languagePack = DEFAULT_LANGUAGE_PACK } = {}) {
    this.i18n = new Jed(languagePack);
  }

  translate(input, ...args) {
    if (input === null || input === undefined) {
      return input;
    }
    const text = this.i18n.gettext(input);

    return args.length > 0 ? sprintf(text, ...args) : text;
  }
}
