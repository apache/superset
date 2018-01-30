import React from 'react';
import ReactDOM from 'react-dom';
import { XYChart, AreaSeries, PointSeries, CrossHair, LinearGradient } from '@data-ui/xy-chart';

import { brandColor } from '../javascripts/modules/colors';
import { d3FormatPreset, d3TimeFormatPreset } from '../javascripts/modules/utils';
import { getTextWidth } from '../javascripts/modules/visUtils';

const fontFamily = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Open Sans,Helvetica Neue,sans-serif';

const CONTAINER_STYLES = {
  fontFamily,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
};

const BIG_NUMBER_STYLES = {
  lineHeight: '1em',
  paddingTop: '0.37em',
  paddingBottom: '0.37em',
  fontWeight: 600,
};

const SUBHEADER_STYLES = {
  fontWeight: 200,
  paddingTop: '0.5em',
  paddingBottom: '0.5em',
  lineHeight: '1em',
};

const CHART_MARGIN = {
  top: 4,
  right: 4,
  bottom: 4,
  left: 4,
};

const NUMBER_SIZE_SCALAR = 0.3;
const CHART_SIZE_SCALAR = 0.2;
const TEXT_SIZE_SCALAR = 0.1;

function getMaxFontSize({ text, totalWidth, idealFontSize, fontWeight = 'normal' }) {
  let fontSize = idealFontSize;
  let textWidth = getTextWidth(text, `${fontWeight} ${fontSize}px ${fontFamily}`);
  while (textWidth > totalWidth) {
    fontSize -= 2;
    textWidth = getTextWidth(text, `${fontWeight} ${fontSize}px ${fontFamily}`);
  }
  return fontSize;
}

function renderTooltipFactory({ formatDate, formatValue }) {
  return function renderTooltip({ datum }) { // eslint-disable-line
    const { x: rawDate, y: rawValue } = datum;
    const formattedDate = formatDate(rawDate);
    const value = formatValue(rawValue);

    return (
      <div style={{ padding: '4px 8px' }}>
        {formattedDate}
        <br />
        <strong>{value}</strong>
      </div>
    );
  };
}
function bigNumberVis(slice, payload) {
  const { formData, containerId } = slice;
  const json = payload.data;
  const { data, subheader, compare_lag: compareLag, compare_suffix: compareSuffix } = json;
  const showTrendline = formData.viz_type === 'big_number';
  const formatValue = d3FormatPreset(formData.y_axis_format);
  const formatPercentChange = d3.format('+.1%');
  const formatDate = d3TimeFormatPreset('smart_date');
  const renderTooltip = renderTooltipFactory({ formatDate, formatValue });
  const gradientId = `big_number_${containerId}`;
  const totalWidth = slice.width();
  const totalHeight = slice.height();

  const bigNumber = showTrendline ? data[data.length - 1][1] : data[0][0];
  let percentChange = null;

  if (showTrendline && compareLag > 0) {
    const compareIndex = data.length - (compareLag + 1);
    if (compareIndex >= 0) {
      const compareValue = data[compareIndex][1];
      percentChange = compareValue === 0
        ? 0 : (bigNumber - compareValue) / Math.abs(compareValue);
    }
  }

  const formattedBigNumber = formatValue(bigNumber);
  const formattedData = showTrendline ? data.map(d => ({ x: d[0], y: d[1] })) : null;
  const formattedSubheader = percentChange === null ? subheader : (
    `${formatPercentChange(percentChange)} ${compareSuffix}`
  );

  const bigNumberFontSize = getMaxFontSize({
    text: formattedBigNumber,
    totalWidth,
    idealFontSize: totalHeight * NUMBER_SIZE_SCALAR,
    fontWeight: BIG_NUMBER_STYLES.fontWeight,
  });

  const subheaderFontSize = formattedSubheader ? getMaxFontSize({
    text: formattedSubheader,
    totalWidth,
    idealFontSize: totalHeight * TEXT_SIZE_SCALAR,
    fontWeight: SUBHEADER_STYLES.fontWeight,
  }) : null;

  const Visualization = (
    <div style={{ height: totalHeight, ...CONTAINER_STYLES }}>
      <div
        style={{
          fontSize: bigNumberFontSize,
          ...BIG_NUMBER_STYLES,
        }}
      >
        {formattedBigNumber}
      </div>

      {showTrendline &&
        <XYChart
          ariaLabel={`Big number visualization ${subheader}`}
          xScale={{ type: 'timeUtc' }}
          yScale={{ type: 'linear' }}
          width={totalWidth}
          height={totalHeight * CHART_SIZE_SCALAR}
          margin={CHART_MARGIN}
          renderTooltip={renderTooltip}
          snapTooltipToDataX
        >
          <LinearGradient
            id={gradientId}
            from={brandColor}
            to="#fff"
          />
          <AreaSeries
            data={formattedData}
            fill={`url(#${gradientId})`}
            stroke={brandColor}
          />
          <PointSeries
            fill={brandColor}
            stroke="#fff"
            data={[formattedData[formattedData.length - 1]]}
          />
          <CrossHair
            stroke={brandColor}
            circleFill={brandColor}
            circleStroke="#fff"
            showHorizontalLine={false}
            fullHeight
            strokeDasharray="5,2"
          />
        </XYChart>}

      {formattedSubheader &&
        <div
          style={{
            fontSize: subheaderFontSize,
            ...SUBHEADER_STYLES,
          }}
        >
          {formattedSubheader}
        </div>}
    </div>
  );

  ReactDOM.render(
    Visualization,
    document.getElementById(containerId),
  );
}

module.exports = bigNumberVis;
