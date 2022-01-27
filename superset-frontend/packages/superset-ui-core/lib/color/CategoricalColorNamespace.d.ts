import CategoricalColorScale from './CategoricalColorScale';
import { ColorsLookup } from './types';
export default class CategoricalColorNamespace {
    name: string;
    forcedItems: ColorsLookup;
    scales: {
        [key: string]: CategoricalColorScale;
    };
    constructor(name: string);
    getScale(schemeId?: string): CategoricalColorScale;
    /**
     * Enforce specific color for given value
     * This will apply across all color scales
     * in this namespace.
     * @param {*} value value
     * @param {*} forcedColor color
     */
    setColor(value: string, forcedColor: string): this;
    resetColors(): void;
}
export declare const DEFAULT_NAMESPACE = "GLOBAL";
export declare function getNamespace(name?: string): CategoricalColorNamespace;
export declare function getColor(value?: string, schemeId?: string, namespace?: string): string;
export declare function getScale(scheme?: string, namespace?: string): CategoricalColorScale;
//# sourceMappingURL=CategoricalColorNamespace.d.ts.map