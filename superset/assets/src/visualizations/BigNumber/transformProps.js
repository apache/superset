import * as color from 'd3-color';
import d3 from 'd3';
import { d3FormatPreset } from '../../modules/utils';
import { renderTooltipFactory } from './BigNumber';

const TIME_COLUMN = '__timestamp';

export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    colorPicker,
    compareLag: compareLagInput,
    compareSuffix = '',
    metric,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    vizType,
    yAxisFormat,
  } = formData;
  const { data } = payload;

  let mainColor;
  if (colorPicker) {
    const { r, g, b } = colorPicker;
    mainColor = color.rgb(r, g, b).hex();
  }

  let bigNumber;
  let trendLineData;
  const metricName = metric.label || metric;
  const compareLag = +compareLagInput || 0;
  const supportTrendLine = vizType === 'big_number';
  const supportAndShowTrendLine = supportTrendLine && showTrendLine;
  let percentChange = 0;
  let formattedSubheader = subheader;
  if (supportTrendLine) {
    const sortedData = [...data].sort((a, b) => a[TIME_COLUMN] - b[TIME_COLUMN]);
    bigNumber = sortedData[sortedData.length - 1][metricName];
    if (compareLag > 0) {
      const compareIndex = sortedData.length - (compareLag + 1);
      if (compareIndex >= 0) {
        const compareValue = sortedData[compareIndex][metricName];
        percentChange = compareValue === 0
          ? 0 : (bigNumber - compareValue) / Math.abs(compareValue);
        const formatPercentChange = d3.format('+.1%');
        formattedSubheader = `${formatPercentChange(percentChange)} ${compareSuffix}`;
      }
    }
    trendLineData = supportAndShowTrendLine
      ? sortedData.map(point => ({ x: point[TIME_COLUMN], y: point[metricName] }))
      : null;
  } else {
    bigNumber = data[0][metricName];
    trendLineData = null;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  const formatValue = d3FormatPreset(yAxisFormat);

  return {
    width,
    height,
    bigNumber,
    className,
    formatBigNumber: formatValue,
    mainColor,
    renderTooltip: renderTooltipFactory(formatValue),
    showTrendLine: supportAndShowTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    trendLineData,
  };
}
