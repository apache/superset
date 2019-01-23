declare module 'jed' {
  export interface LanguagePack {
    domain: string;
    locale_data: {
      superset: {
        [key: string]: string[] | {
          domain: string;
          plural_forms: string;
          lang: string;
        };
      };
    }
  }

  export default class Jed {
    constructor(languagepack: LanguagePack);

    translate(input: string): Jed;
    ifPlural(value: number, plural: string): Jed;
    fetch(...args: any[]): string;
  }
}
