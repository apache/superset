import Jed from 'jed';

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

    return this.i18n.translate(input).fetch(...args);
  }

  translateWithNumber(singular, plural, num = 0, ...args) {
    if (singular === null || singular === undefined) {
      return singular;
    }
    if (plural === null || plural === undefined) {
      return plural;
    }

    return this.i18n
      .translate(singular)
      .ifPlural(num, plural)
      .fetch(...args);
  }
}
