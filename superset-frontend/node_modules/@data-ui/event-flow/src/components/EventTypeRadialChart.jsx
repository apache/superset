import React from 'react';
import PropTypes from 'prop-types';

import { RadialChart, ArcSeries, ArcLabel } from '@data-ui/radial-chart';
import { FILTERED_EVENTS } from '../constants';

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string, // used for colors
    }),
  ).isRequired,
  pieValue: PropTypes.func,
  colorScale: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
};

const defaultProps = {
  pieValue: d => d.value,
  margin: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

const innerRadius = 0;
const outerRadius = radius => radius * 0.9;
const labelRadius = radius => radius * 0.5;

function EventTypeRadialChart({ width, height, margin, colorScale, pieValue, data }) {
  return (
    <RadialChart ariaLabel="Event type fractions" width={width} height={height} margin={margin}>
      <ArcSeries
        data={data}
        pieValue={pieValue}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        labelRadius={labelRadius}
        fill={arc => colorScale(arc.data.label)}
        stroke="#fff"
        fillOpacity={0.8}
        strokeWidth={2}
        cornerRadius={4}
        label={arc => {
          if (arc.data && arc.data.label) {
            return arc.data.label === FILTERED_EVENTS ? 'filtered' : arc.data.label.slice(0, 10);
          }

          return null;
        }}
        labelComponent={<ArcLabel fontSize={10} fill="#333" stroke="#fff" />}
      />
    </RadialChart>
  );
}

EventTypeRadialChart.propTypes = propTypes;
EventTypeRadialChart.defaultProps = defaultProps;

export default EventTypeRadialChart;
