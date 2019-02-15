export interface LanguagePack {
  domain: string;
  /* eslint-disable-next-line camelcase */
  locale_data: {
    superset: {
      [key: string]:
        | string[]
        | {
            domain: string;
            /* eslint-disable-next-line camelcase */
            plural_forms: string;
            lang: string;
          };
    };
  };
}

export interface TranslatorConfig {
  languagePack?: LanguagePack;
}
