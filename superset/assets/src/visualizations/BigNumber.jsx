import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { XYChart, AreaSeries, CrossHair, LinearGradient } from '@data-ui/xy-chart';

import { brandColor } from '../modules/colors';
import { d3FormatPreset } from '../modules/utils';
import { formatDateVerbose } from '../modules/dates';
import { computeMaxFontSize } from '../modules/visUtils';

import './big_number.css';

const CHART_MARGIN = {
  top: 4,
  right: 4,
  bottom: 4,
  left: 4,
};

const PROPORTION = {
  HEADER: 0.4,
  SUBHEADER: 0.14,
  HEADER_WITH_TRENDLINE: 0.3,
  SUBHEADER_WITH_TRENDLINE: 0.125,
  TRENDLINE: 0.3,
};

function renderTooltipFactory(formatValue) {
  return function renderTooltip({ datum }) { // eslint-disable-line
    const { x: rawDate, y: rawValue } = datum;
    const formattedDate = formatDateVerbose(rawDate);
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

function identity(x) {
  return x;
}

const propTypes = {
  className: PropTypes.string,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  bigNumber: PropTypes.number.isRequired,
  formatBigNumber: PropTypes.func,
  subheader: PropTypes.string,
  showTrendline: PropTypes.bool,
  trendlineData: PropTypes.array,
  mainColor: PropTypes.string,
  gradientId: PropTypes.string,
  renderTooltip: PropTypes.func,
};
const defaultProps = {
  className: '',
  formatBigNumber: identity,
  subheader: '',
  showTrendline: false,
  trendlineData: null,
  mainColor: brandColor,
  gradientId: '',
  renderTooltip: renderTooltipFactory(identity),
};

class BigNumberVis extends React.Component {
  getClassName() {
    const { className, showTrendline } = this.props;
    const names = `big_number ${className}`;
    if (showTrendline) {
      return names;
    }
    return `${names} no_trendline`;
  }

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = this.getClassName();
    container.style.position = 'absolute'; // so it won't disrupt page layout
    container.style.opacity = 0;           // and not visible
    return container;
  }

  renderHeader(maxHeight) {
    const { bigNumber, formatBigNumber, width } = this.props;
    const text = formatBigNumber(bigNumber);

    const container = this.createTemporaryContainer();
    document.body.appendChild(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'header_line',
      container,
    });
    document.body.removeChild(container);

    return (
      <div
        className="header_line"
        style={{
          fontSize,
          height: maxHeight,
        }}
      >
        <span>{text}</span>
      </div>
    );
  }

  renderSubheader(maxHeight) {
    const { subheader, width } = this.props;
    let fontSize = 0;
    if (subheader) {
      const container = this.createTemporaryContainer();
      document.body.appendChild(container);
      fontSize = computeMaxFontSize({
        text: subheader,
        maxWidth: width,
        maxHeight,
        className: 'subheader_line',
        container,
      });
      document.body.removeChild(container);
    }

    return (
      <div
        className="subheader_line"
        style={{
          fontSize,
          height: maxHeight,
        }}
      >
        {subheader}
      </div>
    );
  }

  renderTrendline(maxHeight) {
    const {
      width,
      trendlineData,
      mainColor,
      subheader,
      renderTooltip,
      gradientId,
    } = this.props;
    return (
      <XYChart
        ariaLabel={`Big number visualization ${subheader}`}
        xScale={{ type: 'timeUtc' }}
        yScale={{ type: 'linear' }}
        width={width}
        height={maxHeight}
        margin={CHART_MARGIN}
        renderTooltip={renderTooltip}
        snapTooltipToDataX
      >
        <LinearGradient
          id={gradientId}
          from={mainColor}
          to="#fff"
        />
        <AreaSeries
          data={trendlineData}
          fill={`url(#${gradientId})`}
          stroke={mainColor}
        />
        <CrossHair
          stroke={mainColor}
          circleFill={mainColor}
          circleStroke="#fff"
          showHorizontalLine={false}
          fullHeight
          strokeDasharray="5,2"
        />
      </XYChart>
    );
  }

  render() {
    const { showTrendline, height } = this.props;
    const className = this.getClassName();

    if (showTrendline) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;
      return (
        <div className={className}>
          <div
            className="text_container"
            style={{ height: allTextHeight }}
          >
            {this.renderHeader(Math.ceil(PROPORTION.HEADER_WITH_TRENDLINE * height))}
            {this.renderSubheader(Math.ceil(PROPORTION.SUBHEADER_WITH_TRENDLINE * height))}
          </div>
          {this.renderTrendline(chartHeight)}
        </div>
      );
    }
    return (
      <div
        className={className}
        style={{ height }}
      >
        {this.renderHeader(Math.ceil(PROPORTION.HEADER * height))}
        {this.renderSubheader(Math.ceil(PROPORTION.SUBHEADER * height))}
      </div>
    );
  }
}

BigNumberVis.propTypes = propTypes;
BigNumberVis.defaultProps = defaultProps;

function adaptor(slice, payload) {
  const { formData, containerId } = slice;
  const { data, subheader, compare_suffix: compareSuffix } = payload.data;
  const compareLag = Number(payload.data.compare_lag);
  const supportTrendline = formData.viz_type === 'big_number';
  const showTrendline = supportTrendline && formData.show_trend_line;
  const formatValue = d3FormatPreset(formData.y_axis_format);
  const bigNumber = supportTrendline ? data[data.length - 1][1] : data[0][0];

  let percentChange = 0;
  let formattedSubheader = subheader;

  if (supportTrendline && compareLag > 0) {
    const compareIndex = data.length - (compareLag + 1);
    if (compareIndex >= 0) {
      const compareValue = data[compareIndex][1];
      percentChange = compareValue === 0
        ? 0 : (bigNumber - compareValue) / Math.abs(compareValue);
      const formatPercentChange = d3.format('+.1%');
      formattedSubheader = `${formatPercentChange(percentChange)} ${compareSuffix}`;
    }
  }

  const trendlineData = showTrendline ? data.map(([x, y]) => ({ x, y })) : null;

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  ReactDOM.render(
    <BigNumberVis
      className={className}
      width={slice.width()}
      height={slice.height()}
      bigNumber={bigNumber}
      formatBigNumber={formatValue}
      subheader={formattedSubheader}
      showTrendline={showTrendline}
      trendlineData={trendlineData}
      mainColor={brandColor}
      gradientId={`big_number_${containerId}`}
      renderTooltip={renderTooltipFactory(formatValue)}
    />,
    document.getElementById(containerId),
  );
}

export default adaptor;
