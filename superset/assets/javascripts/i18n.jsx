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

const i18n = (function () {
  let languagePack = DEFAULT_LANGUAGE_PACK;

  if (typeof window !== 'undefined') {
    const root = document.getElementById('app');
    const bootstrapData = root ? JSON.parse(root.getAttribute('data-bootstrap')) : {};
    if (bootstrapData.common && bootstrapData.common.language_pack) {
      languagePack = bootstrapData.common.language_pack;
      delete bootstrapData.common.locale;
      delete bootstrapData.common.language_pack;
    }
  }

  return new Jed(languagePack);
}());

export default i18n;
