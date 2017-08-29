import { setLanguagePack } from '../../javascripts/locales';

beforeEach(() => {
  setLanguagePack({
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
  });
});
