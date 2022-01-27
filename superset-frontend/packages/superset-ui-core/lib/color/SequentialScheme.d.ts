import ColorScheme, { ColorSchemeConfig } from './ColorScheme';
export interface SequentialSchemeConfig extends ColorSchemeConfig {
    isDiverging?: boolean;
}
export default class SequentialScheme extends ColorScheme {
    isDiverging: boolean;
    constructor(config: SequentialSchemeConfig);
    /**
     * Return a linear scale with a new domain interpolated from the input domain
     * to match the number of elements in the color scheme
     * because D3 continuous scale uses piecewise mapping between domain and range.
     * This is a common use-case when the domain is [min, max]
     * and the palette has more than two colors.
     *
     * @param domain domain of the scale
     * @param modifyRange Set this to true if you don't want to modify the domain and
     * want to interpolate range to have the same number of elements with domain instead.
     */
    createLinearScale(domain?: number[], modifyRange?: boolean): import("d3-scale").ScaleLinear<string, string>;
    /**
     * Get colors from this scheme
     * @param numColors number of colors to return.
     * Will interpolate the current scheme to match the number of colors requested
     * @param extent The extent of the color range to use.
     * For example [0.2, 1] will rescale the color scheme
     * such that color values in the range [0, 0.2) are excluded from the scheme.
     */
    getColors(numColors?: number, extent?: number[]): string[];
}
//# sourceMappingURL=SequentialScheme.d.ts.map