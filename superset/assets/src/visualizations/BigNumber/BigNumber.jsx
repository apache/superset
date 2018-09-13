import React from 'react';
import PropTypes from 'prop-types';

import { XYChart, AreaSeries, CrossHair, LinearGradient } from '@data-ui/xy-chart';

import { brandColor } from '../../modules/colors';
import { formatDateVerbose } from '../../modules/dates';
import { computeMaxFontSize } from '../../modules/visUtils';

import './BigNumber.css';

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

export function renderTooltipFactory(formatValue) {
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
  startYAxisAtZero: PropTypes.bool,
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
  startYAxisAtZero: true,
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
      maxWidth: Math.floor(width),
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
        maxWidth: Math.floor(width),
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
      startYAxisAtZero,
    } = this.props;
    return (
      <XYChart
        ariaLabel={`Big number visualization ${subheader}`}
        xScale={{ type: 'timeUtc' }}
        yScale={{
          type: 'linear',
          includeZero: startYAxisAtZero,
        }}
        width={Math.floor(width)}
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

export default BigNumberVis;
