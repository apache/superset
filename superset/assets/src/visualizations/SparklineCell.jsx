import React from 'react';
import PropTypes from 'prop-types';
import { Sparkline, LineSeries, PointSeries, HorizontalReferenceLine, VerticalReferenceLine, WithTooltip } from '@data-ui/sparkline';
import { d3format } from '../modules/utils';
import { getTextDimension } from '../modules/visUtils';

const propTypes = {
  className: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  data: PropTypes.array.isRequired,
  ariaLabel: PropTypes.string,
  numberFormat: PropTypes.string,
  yAxisBounds: PropTypes.array,
  showYAxisBounds: PropTypes.bool,
  renderTooltip: PropTypes.func,
};
const defaultProps = {
  className: '',
  width: 300,
  height: 50,
  ariaLabel: '',
  numberFormat: undefined,
  yAxisBounds: [null, null],
  showYAxisBounds: false,
  renderTooltip() { return <div />; },
};

const SPARKLINE_MARGIN = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
};
const sparklineTooltipProps = {
  style: {
    opacity: 0.8,
  },
  offsetTop: 0,
};

function getSparklineTextWidth(text) {
  return getTextDimension({
    text,
    style: {
      fontSize: '12px',
      fontWeight: 200,
      letterSpacing: 0.4,
    },
  }).width + 5;
}

function isValidBoundValue(value) {
  return value !== null && value !== undefined && value !== '' && !Number.isNaN(value);
}

class SparklineCell extends React.Component {
  renderLine() {

  }

  render() {
    const {
      width,
      height,
      data,
      ariaLabel,
      numberFormat,
      yAxisBounds,
      showYAxisBounds,
      renderTooltip,
    } = this.props;

    const yScale = {};
    let hasMin = false;
    let hasMax = false;
    let minLabel = '';
    let maxLabel = '';
    let labelLength = 0;
    if (yAxisBounds) {
      const [min, max] = yAxisBounds;
      hasMin = isValidBoundValue(min);
      if (hasMin) {
        yScale.min = min;
        minLabel = d3format(numberFormat, yScale.min);
        labelLength = getSparklineTextWidth(minLabel);
      }
      hasMax = isValidBoundValue(max);
      if (hasMax) {
        yScale.max = max;
        maxLabel = d3format(numberFormat, yScale.max);
        labelLength = Math.max(labelLength, getSparklineTextWidth(maxLabel));
      }
    }
    const margin = {
      ...SPARKLINE_MARGIN,
      right: SPARKLINE_MARGIN.right + labelLength,
    };

    return (
      <WithTooltip
        tooltipProps={sparklineTooltipProps}
        hoverStyles={null}
        renderTooltip={renderTooltip}
      >
        {({ onMouseLeave, onMouseMove, tooltipData }) => (
          <Sparkline
            ariaLabel={ariaLabel}
            width={width}
            height={height}
            margin={margin}
            data={data}
            onMouseLeave={onMouseLeave}
            onMouseMove={onMouseMove}
            {...yScale}
          >
            {showYAxisBounds && hasMin &&
              <HorizontalReferenceLine
                reference={yScale.min}
                labelPosition="right"
                renderLabel={() => minLabel}
                stroke="#bbb"
                strokeDasharray="3 3"
                strokeWidth={1}
              />}
            {showYAxisBounds && hasMax &&
              <HorizontalReferenceLine
                reference={yScale.max}
                labelPosition="right"
                renderLabel={() => maxLabel}
                stroke="#bbb"
                strokeDasharray="3 3"
                strokeWidth={1}
              />}
            <LineSeries
              showArea={false}
              stroke="#767676"
            />
            {tooltipData &&
              <VerticalReferenceLine
                reference={tooltipData.index}
                strokeDasharray="3 3"
                strokeWidth={1}
              />}
            {tooltipData &&
              <PointSeries
                points={[tooltipData.index]}
                fill="#767676"
                strokeWidth={1}
              />}
          </Sparkline>
        )}
      </WithTooltip>
    );
  }
}

SparklineCell.propTypes = propTypes;
SparklineCell.defaultProps = defaultProps;

export default SparklineCell;
