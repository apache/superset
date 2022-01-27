import { QueryObject } from './Query';
export declare type TimeRange = {
    /** Time range of the query [from, to] */
    time_range?: string;
    since?: string;
    until?: string;
};
export declare type TimeColumnConfigKey = '__time_col' | '__time_grain' | '__time_range' | '__time_origin' | '__granularity';
export declare type AppliedTimeExtras = Partial<Record<TimeColumnConfigKey, keyof QueryObject>>;
export declare type TimeRangeEndpoint = 'unknown' | 'inclusive' | 'exclusive';
export declare type TimeRangeEndpoints = [TimeRangeEndpoint, TimeRangeEndpoint];
declare const _default: {};
export default _default;
//# sourceMappingURL=Time.d.ts.map