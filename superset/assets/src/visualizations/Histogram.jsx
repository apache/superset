import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import { Histogram, BarSeries, XAxis, YAxis } from '@data-ui/histogram';
import { chartTheme } from '@data-ui/theme';
import { getColorFromScheme } from '../modules/colors';

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    values: PropTypes.arrayOf(PropTypes.number),
  })).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  colorScheme: PropTypes.string,
  normalized: PropTypes.bool,
  binCount: PropTypes.number,
  opacity: PropTypes.number,
  xAxisLabel: PropTypes.string,
  yAxisLabel: PropTypes.string,
};
const defaultProps = {
  className: '',
  colorScheme: '',
  normalized: false,
  binCount: 15,
  opacity: 1,
  xAxisLabel: '',
  yAxisLabel: '',
};

class CustomHistogram extends React.PureComponent {
  render() {
    const {
      className,
      data,
      width,
      height,
      binCount,
      colorScheme,
      normalized,
      opacity,
      xAxisLabel,
      yAxisLabel,
    } = this.props;

    const colorFn = value => getColorFromScheme(value, colorScheme);

    return (
      <Histogram
        width={width}
        height={height}
        ariaLabel="Histogram"
        normalized={normalized}
        binCount={binCount}
        binType="numeric"
        renderTooltip={({ datum, color }) => (
          <div>
            <strong style={{ color }}>{datum.bin0} to {datum.bin1}</strong>
            <div><strong>count </strong>{datum.count}</div>
            <div><strong>cumulative </strong>{datum.cumulative}</div>
          </div>
        )}
        valueAccessor={datum => datum}
        theme={chartTheme}
      >
        {data.map(series => (
          <BarSeries
            key={series.key}
            animated
            rawData={series.values}
            fill={colorFn(series.key)}
            fillOpacity={opacity}
          />
        ))}
        <XAxis label={xAxisLabel} />
        <YAxis label={yAxisLabel} />
      </Histogram>
    );
  }
}

CustomHistogram.propTypes = propTypes;
CustomHistogram.defaultProps = defaultProps;

//     // make legend
//     const legend = nv.models.legend()
//       .color(d => getColorFromScheme(d.key, colorScheme))
//       .width(innerWidth);
//     const gLegend = gEnter.append('g')
//       .attr('class', 'nv-legendWrap')
//       .attr('transform', 'translate(0,' + (-margin.top) + ')')
//       .datum(data.map(d => ({ ...d, disabled: false })));

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const {
    color_scheme: colorScheme,
    link_length: binCount,
    normalized,
    global_opacity: opacity,
    x_axis_label: xAxisLabel,
    y_axis_label: yAxisLabel,
  } = formData;

  ReactDOM.render(
    <CustomHistogram
      data={payload.data}
      width={slice.width()}
      height={slice.height()}
      binCount={parseInt(binCount, 10)}
      colorScheme={colorScheme}
      normalized={normalized}
      opacity={opacity}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
    />,
    document.querySelector(selector),
  );
}

export default adaptor;
