import { format, parseISO } from 'date-fns';

export const ChartAxisLabelColor = '#111827';

export const ChartAxisLineColor = '#d1d5db';

export const ChartGridLineColor = '#f3f4f6';

export const ChartSliderSeparation = 30;

export const ChartSliderBorderPadding = 8;

export const ChartSliderHeight = 32;

export const ChartXYContainerDefaultMargin = {
  top: 0,
  right: 80,
  bottom: 25,
  left: 22,
};

export const ChartDefaultSeriesSecondaryColor = '#40A9FF';

export const ChartDefaultSeriesPrimaryColor = '#FA8C16';

export const ChartMaxTickLabelLength = 12;

export const ChartMaxXTicksCount = 15;

export const ChartYAxisLabelOffset = 30;

export const tickLongLabelProps = {
  overflow: 'hidden',
  textAnchor: 'end' as const,
  angle: 90,
  dy: '-0.5em',
  dx: '-0.3em',
  width: 120,
  height: 20,
};

const tickLabelBaseProps = {
  fontFamily: 'Inter',
  fontSize: 11,
  fontWeight: 400,
  fill: ChartAxisLabelColor,
};

export const ChartAxisBottomTickLongLabelProps = {
  ...tickLabelBaseProps,
  ...tickLongLabelProps,
  textAnchor: 'start' as const,
};

export const ChartAxisBottomTickLabelProps = {
  ...tickLabelBaseProps,
  textAnchor: 'middle' as const,
};

export const ChartAxisLeftTickLabelProps = {
  ...tickLabelBaseProps,
  dx: '-0.25em',
  dy: '0.25em',
  textAnchor: 'end' as const,
};

export const ChartGridBaseConfig = {
  lineStyle: { stroke: ChartGridLineColor },
  strokeWidth: 1,
};

export const ChartAxisBaseConfig = {
  stroke: ChartAxisLineColor,
  tickStroke: ChartAxisLineColor,
};

export const ChartLeftAxisBaseConfig = {
  ...ChartAxisBaseConfig,
  tickLabelProps: ChartAxisLeftTickLabelProps,
};

export const ChartBottomAxisBaseConfig = {
  ...ChartAxisBaseConfig,
  tickLabelProps: ChartAxisBottomTickLabelProps,
};

export const ChartBottomAxisLongLabelConfig = {
  ...ChartAxisBaseConfig,
  tickLabelProps: ChartAxisBottomTickLongLabelProps,
};

export const formatISO = (date: string | Date, dateFormat: string) =>
  date instanceof Date
    ? format(date, dateFormat)
    : format(parseISO(date), dateFormat);

export const formatDateForChart = (
  value: string,
  { includeDay } = { includeDay: true },
) => formatISO(value, `MMM${includeDay ? ' d,' : ''} ''yy`);

export const formatNumber = (
  rawValue: number | string,
  options?: Intl.NumberFormatOptions | undefined,
) => {
  const value = Number(rawValue);
  return Intl.NumberFormat('en', options).format(value);
};

export const toStandardAmount = (rawValue: number | string, decimals = 2) =>
  formatNumber(rawValue, {
    notation: 'standard',
    maximumFractionDigits: decimals,
  });
