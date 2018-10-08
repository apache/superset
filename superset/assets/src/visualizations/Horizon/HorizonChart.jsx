import React from 'react';
import PropTypes from 'prop-types';
import d3 from 'd3';
import HorizonRow, { DEFAULT_COLORS } from './HorizonRow';
import './HorizonChart.css';

const propTypes = {
  className: PropTypes.string,
  width: PropTypes.number,
  seriesHeight: PropTypes.number,
  data: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.arrayOf(PropTypes.string),
    values: PropTypes.arrayOf(PropTypes.shape({
      y: PropTypes.number,
    })),
  })).isRequired,
  // number of bands in each direction (positive / negative)
  bands: PropTypes.number,
  colors: PropTypes.arrayOf(PropTypes.string),
  colorScale: PropTypes.string,
  mode: PropTypes.string,
  offsetX: PropTypes.number,
};
const defaultProps = {
  className: '',
  width: 800,
  seriesHeight: 20,
  bands: Math.floor(DEFAULT_COLORS.length / 2),
  colors: DEFAULT_COLORS,
  colorScale: 'series',
  mode: 'offset',
  offsetX: 0,
};

class HorizonChart extends React.PureComponent {
  render() {
    const {
      className,
      width,
      data,
      seriesHeight,
      bands,
      colors,
      colorScale,
      mode,
      offsetX,
    } = this.props;

    let yDomain;
    if (colorScale === 'overall') {
      const allValues = data.reduce(
        (acc, current) => acc.concat(current.values),
        [],
      );
      yDomain = d3.extent(allValues, d => d.y);
    }

    return (
      <div className={`horizon-chart ${className}`}>
        {data.map(row => (
          <HorizonRow
            key={row.key}
            width={width}
            height={seriesHeight}
            title={row.key[0]}
            data={row.values}
            bands={bands}
            colors={colors}
            colorScale={colorScale}
            mode={mode}
            offsetX={offsetX}
            yDomain={yDomain}
          />
        ))}
      </div>
    );
  }
}

HorizonChart.propTypes = propTypes;
HorizonChart.defaultProps = defaultProps;

export default HorizonChart;
