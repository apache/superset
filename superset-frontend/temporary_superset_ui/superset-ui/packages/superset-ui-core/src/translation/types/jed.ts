/**
 * Translations for a language in the format of { key: [singular, plural, ...]}.
 */
export type Translations = {
  [key: string]: ReadonlyArray<string>;
};

export interface DomainConfig {
  domain: string;
  lang: string;
  // eslint-disable-next-line camelcase
  plural_forms: string;
}

export type DomainData = { '': DomainConfig } & {
  [key: string]: ReadonlyArray<string> | DomainConfig;
};

export interface JedOptions {
  domain: string;
  // eslint-disable-next-line camelcase
  locale_data: {
    [domain: string]: DomainData;
  };
}

export interface Jed {
  translate(input: string): Jed;

  ifPlural(value: number, plural: string): Jed;

  fetch(...args: unknown[]): string;

  options: JedOptions;
}

export default {};
