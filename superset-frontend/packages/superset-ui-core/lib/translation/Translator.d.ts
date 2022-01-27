import { Jed, TranslatorConfig, Locale, Translations, LocaleData } from './types';
export default class Translator {
    i18n: Jed;
    locale: Locale;
    constructor(config?: TranslatorConfig);
    /**
     * Add additional translations on the fly, used by plugins.
     */
    addTranslation(key: string, texts: ReadonlyArray<string>): void;
    /**
     * Add a series of translations.
     */
    addTranslations(translations: Translations): void;
    addLocaleData(data: LocaleData): void;
    translate(input: string, ...args: unknown[]): string;
    translateWithNumber(key: string, ...args: unknown[]): string;
}
//# sourceMappingURL=Translator.d.ts.map