import React from 'react';
import ReactDOM from 'react-dom';
import * as color from 'd3-color';
import d3 from 'd3';

import BigNumberVis, { renderTooltipFactory } from './BigNumber';
import { d3FormatPreset } from '../../modules/utils';

const TIME_COLUMN = '__timestamp';

function transform(data, formData) {
  let bigNumber;
  let trendlineData;
  const metricName = formData.metric.label || formData.metric;
  const compareSuffix = formData.compare_suffix || '';
  const compareLag = +formData.compare_lag || 0;
  const supportTrendline = formData.viz_type === 'big_number';
  const showTrendline = supportTrendline && formData.show_trend_line;
  let percentChange = 0;
  const subheader = formData.subheader || '';
  let formattedSubheader = subheader;
  if (supportTrendline) {
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
    trendlineData = showTrendline
      ? sortedData.map(point => ({ x: point[TIME_COLUMN], y: point[metricName] }))
      : null;
  } else {
    bigNumber = data[0][metricName];
    trendlineData = null;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  return {
    bigNumber,
    trendlineData,
    className,
    subheader: formattedSubheader,
    showTrendline,
  };
}

function adaptor(slice, payload) {
  const { formData, containerId } = slice;

  const transformedData = transform(payload.data, formData);
  const startYAxisAtZero = formData.start_y_axis_at_zero;
  const formatValue = d3FormatPreset(formData.y_axis_format);
  let userColor;
  if (formData.color_picker) {
    const { r, g, b } = formData.color_picker;
    userColor = color.rgb(r, g, b).hex();
  }

  ReactDOM.render(
    <BigNumberVis
      width={slice.width()}
      height={slice.height()}
      formatBigNumber={formatValue}
      startYAxisAtZero={startYAxisAtZero}
      mainColor={userColor}
      gradientId={`big_number_${containerId}`}
      renderTooltip={renderTooltipFactory(formatValue)}
      {...transformedData}
    />,
    document.getElementById(containerId),
  );
}

export default adaptor;
