import { Value, ScaleConfig } from 'encodable';
declare type DataUIScaleType = 'time' | 'timeUtc' | 'linear' | 'band';
interface DataUIScale {
    type: DataUIScaleType;
    domain?: number[] | string[];
    includeZero?: boolean;
    nice?: boolean;
    paddingInner?: number;
    paddingOuter?: number;
    range?: number[] | string[];
    rangeRound?: number[] | string[];
}
/**
 * Convert encodeable scale object into @data-ui's scale config
 * @param scale
 */
export default function convertScaleToDataUIScale<Output extends Value>(scale: ScaleConfig<Output>): DataUIScale;
export {};
//# sourceMappingURL=convertScaleToDataUIScaleShape.d.ts.map