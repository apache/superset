import { ScaleOrdinal } from 'd3-scale';
import { ExtensibleFunction } from '../models';
import { ColorsLookup } from './types';
interface CategoricalColorScale {
    (x: {
        toString(): string;
    }): string;
}
declare class CategoricalColorScale extends ExtensibleFunction {
    colors: string[];
    scale: ScaleOrdinal<{
        toString(): string;
    }, string>;
    parentForcedColors?: ColorsLookup;
    forcedColors: ColorsLookup;
    /**
     * Constructor
     * @param {*} colors an array of colors
     * @param {*} parentForcedColors optional parameter that comes from parent
     * (usually CategoricalColorNamespace) and supersede this.forcedColors
     */
    constructor(colors: string[], parentForcedColors?: ColorsLookup);
    getColor(value?: string): string;
    /**
     * Enforce specific color for given value
     * @param {*} value value
     * @param {*} forcedColor forcedColor
     */
    setColor(value: string, forcedColor: string): this;
    /**
     * Get a mapping of data values to colors
     * @returns an object where the key is the data value and the value is the hex color code
     */
    getColorMap(): {
        [x: string]: string | undefined;
    };
    /**
     * Returns an exact copy of this scale. Changes to this scale will not affect the returned scale, and vice versa.
     */
    copy(): CategoricalColorScale;
    /**
     * Returns the scale's current domain.
     */
    domain(): {
        toString(): string;
    }[];
    /**
     * Expands the domain to include the specified array of values.
     */
    domain(newDomain: {
        toString(): string;
    }[]): this;
    /**
     * Returns the scale's current range.
     */
    range(): string[];
    /**
     * Sets the range of the ordinal scale to the specified array of values.
     *
     * The first element in the domain will be mapped to the first element in range, the second domain value to the second range value, and so on.
     *
     * If there are fewer elements in the range than in the domain, the scale will reuse values from the start of the range.
     *
     * @param range Array of range values.
     */
    range(newRange: string[]): this;
    /**
     * Returns the current unknown value, which defaults to "implicit".
     */
    unknown(): string | {
        name: 'implicit';
    };
    /**
     * Sets the output value of the scale for unknown input values and returns this scale.
     * The implicit value enables implicit domain construction. scaleImplicit can be used as a convenience to set the implicit value.
     *
     * @param value Unknown value to be used or scaleImplicit to set implicit scale generation.
     */
    unknown(value: string | {
        name: 'implicit';
    }): this;
}
export default CategoricalColorScale;
//# sourceMappingURL=CategoricalColorScale.d.ts.map