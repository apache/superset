export function cleanColorInput(value: any): string;
/**
 * If format is smart_date, format date
 * Otherwise, format number with the given format name
 * @param {*} format
 */
export function getTimeOrNumberFormatter(format: any): import("packages/superset-ui-core/src/time-format/TimeFormatter").default | import("packages/superset-ui-core/src/number-format/NumberFormatter").default;
export function drawBarValues(svg: any, data: any, stacked: any, axisFormat: any): void;
export function generateRichLineTooltipContent(d: any, timeFormatter: any, valueFormatter: any): any;
export function generateCompareTooltipContent(d: any, valueFormatter: any): any;
export function generateAreaChartTooltipContent(d: any, timeFormatter: any, valueFormatter: any, chart: any): any;
export function generateMultiLineTooltipContent(d: any, xFormatter: any, yFormatters: any): string;
export function generateTimePivotTooltip(d: any, xFormatter: any, yFormatter: any): any;
export function generateBubbleTooltipContent({ point, entity, xField, yField, sizeField, xFormatter, yFormatter, sizeFormatter, }: {
    point: any;
    entity: any;
    xField: any;
    yField: any;
    sizeField: any;
    xFormatter: any;
    yFormatter: any;
    sizeFormatter: any;
}): string;
export function hideTooltips(shouldRemove: any): void;
export function generateTooltipClassName(uuid: any): string;
export function removeTooltip(uuid: any): void;
export function wrapTooltip(chart: any): void;
export function tipFactory(layer: any): any;
export function getMaxLabelSize(svg: any, axisClass: any): number;
export function formatLabel(input: any, verboseMap?: {}): any;
export function computeBarChartWidth(data: any, stacked: any, maxWidth: any): number;
export function tryNumify(s: any): any;
export function stringifyTimeRange(extent: any): any;
export function setAxisShowMaxMin(axis: any, showminmax: any): void;
export function computeYDomain(data: any): number[];
export function computeStackedYDomain(data: any): number[];
//# sourceMappingURL=utils.d.ts.map