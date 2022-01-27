import Translator from './Translator';
import { TranslatorConfig, Translations, LocaleData } from './types';
declare function configure(config?: TranslatorConfig): Translator;
declare function resetTranslation(): void;
declare function addTranslation(key: string, translations: string[]): void;
declare function addTranslations(translations: Translations): void;
declare function addLocaleData(data: LocaleData): void;
declare function t(input: string, ...args: unknown[]): string;
declare function tn(key: string, ...args: unknown[]): string;
export { configure, addTranslation, addTranslations, addLocaleData, t, tn, resetTranslation, };
//# sourceMappingURL=TranslatorSingleton.d.ts.map