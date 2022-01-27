export declare type TimeFormatFunction = (value: Date) => string;
export declare type TimeRangeFormatFunction = (values: (Date | number | undefined | null)[]) => string;
/**
 * search for `builtin_time_grains` in incubator-superset/superset/db_engine_specs/base.py
 */
export declare const TimeGranularity: {
    readonly DATE: "date";
    readonly SECOND: "PT1S";
    readonly MINUTE: "PT1M";
    readonly FIVE_MINUTES: "PT5M";
    readonly TEN_MINUTES: "PT10M";
    readonly FIFTEEN_MINUTES: "PT15M";
    readonly THIRTY_MINUTES: "PT30M";
    readonly HOUR: "PT1H";
    readonly DAY: "P1D";
    readonly WEEK: "P1W";
    readonly WEEK_STARTING_SUNDAY: "1969-12-28T00:00:00Z/P1W";
    readonly WEEK_STARTING_MONDAY: "1969-12-29T00:00:00Z/P1W";
    readonly WEEK_ENDING_SATURDAY: "P1W/1970-01-03T00:00:00Z";
    readonly WEEK_ENDING_SUNDAY: "P1W/1970-01-04T00:00:00Z";
    readonly MONTH: "P1M";
    readonly QUARTER: "P3M";
    readonly YEAR: "P1Y";
};
declare type ValueOf<T> = T[keyof T];
export declare type TimeGranularity = ValueOf<typeof TimeGranularity>;
export {};
//# sourceMappingURL=types.d.ts.map