import NumberFormatterRegistry from './NumberFormatterRegistry';
declare const getInstance: () => NumberFormatterRegistry;
export default getInstance;
export declare function getNumberFormatter(format?: string): import("./NumberFormatter").default;
export declare function formatNumber(format: string | undefined, value: number | null | undefined): string;
//# sourceMappingURL=NumberFormatterRegistrySingleton.d.ts.map