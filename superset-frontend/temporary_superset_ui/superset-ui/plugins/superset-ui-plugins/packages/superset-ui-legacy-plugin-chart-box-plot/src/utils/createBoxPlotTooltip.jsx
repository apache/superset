import React from 'react';
import PropTypes from 'prop-types';

export default function createBoxPlotTooltip(formatValue) {
  const propTypes = {
    color: PropTypes.string,
    datum: PropTypes.shape({
      firstQuartile: PropTypes.number,
      max: PropTypes.number,
      median: PropTypes.number,
      min: PropTypes.number,
      outliers: PropTypes.arrayOf(PropTypes.number),
      thirdQuartile: PropTypes.number,
    }).isRequired,
  };
  const defaultProps = {
    color: '#222',
  };

  function BoxPlotTooltip({ datum, color }) {
    const { label, min, max, median, firstQuartile, thirdQuartile, outliers } = datum;

    return (
      <div>
        <div>
          <strong style={{ color }}>{label}</strong>
        </div>
        {min && (
          <div>
            <strong style={{ color }}>Min </strong>
            {formatValue(min)}
          </div>
        )}
        {max && (
          <div>
            <strong style={{ color }}>Max </strong>
            {formatValue(max)}
          </div>
        )}
        {median && (
          <div>
            <strong style={{ color }}>Median </strong>
            {formatValue(median)}
          </div>
        )}
        {firstQuartile && (
          <div>
            <strong style={{ color }}>First quartile </strong>
            {formatValue(firstQuartile)}
          </div>
        )}
        {thirdQuartile && (
          <div>
            <strong style={{ color }}>Third quartile </strong>
            {formatValue(thirdQuartile)}
          </div>
        )}
        {outliers && outliers.length > 0 && (
          <div>
            <strong style={{ color }}># Outliers </strong>
            {outliers.length}
          </div>
        )}
      </div>
    );
  }

  BoxPlotTooltip.propTypes = propTypes;
  BoxPlotTooltip.defaultProps = defaultProps;

  return BoxPlotTooltip;
}
