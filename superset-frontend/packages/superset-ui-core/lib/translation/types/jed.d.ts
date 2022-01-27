/**
 * Translations for a language in the format of { key: [singular, plural, ...]}.
 */
export declare type Translations = {
    [key: string]: ReadonlyArray<string>;
};
export interface DomainConfig {
    domain: string;
    lang: string;
    plural_forms: string;
}
export declare type DomainData = {
    '': DomainConfig;
} & {
    [key: string]: ReadonlyArray<string> | DomainConfig;
};
export interface JedOptions {
    domain: string;
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
declare const _default: {};
export default _default;
//# sourceMappingURL=jed.d.ts.map