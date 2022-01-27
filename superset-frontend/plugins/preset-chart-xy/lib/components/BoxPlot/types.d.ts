export interface RawBoxPlotDataRow {
    label: string;
    values: {
        Q1: number;
        Q2: number;
        Q3: number;
        outliers: number[];
        whisker_high: number;
        whisker_low: number;
    };
}
export interface BoxPlotDataRow {
    label: string;
    min: number;
    max: number;
    firstQuartile: number;
    median: number;
    thirdQuartile: number;
    outliers: number[];
}
//# sourceMappingURL=types.d.ts.map