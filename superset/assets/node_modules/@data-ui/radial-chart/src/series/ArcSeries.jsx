import { Arc } from '@vx/shape';
import React from 'react';
import PropTypes from 'prop-types';

import ArcLabel from '../label/ArcLabel';
import callOrValue from '../util/callOrValue';
import { singleHueScaleFactory } from '../util/fillScaleFactory';

const grayScale = singleHueScaleFactory();

const propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
  })).isRequired,
  pieValue: PropTypes.func.isRequired, // (d) => pie value
  pieSort: PropTypes.func,

  radius: PropTypes.number, // likely passed by parent
  innerRadius: PropTypes.oneOfType([PropTypes.func, PropTypes.number]), // (radius) => num
  outerRadius: PropTypes.oneOfType([PropTypes.func, PropTypes.number]), // (radius) => num
  labelRadius: PropTypes.oneOfType([PropTypes.func, PropTypes.number]), // (radius) => num
  labelComponent: PropTypes.oneOfType([PropTypes.func, PropTypes.element]),
  label: PropTypes.func, // (arc) => node

  stroke: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  strokeWidth: PropTypes.oneOfType([PropTypes.func, PropTypes.number]),
  fill: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  fillOpacity: PropTypes.oneOfType([PropTypes.func, PropTypes.number]),

  padAngle: PropTypes.oneOfType([PropTypes.func, PropTypes.number]),
  padRadius: PropTypes.oneOfType([PropTypes.func, PropTypes.number]),
  cornerRadius: PropTypes.oneOfType([PropTypes.func, PropTypes.number]),
  onMouseMove: PropTypes.func,
  onMouseLeave: PropTypes.func,
};

const defaultProps = {
  radius: 300,
  pieSort: null,
  innerRadius: radius => radius * 0.5,
  outerRadius: radius => radius * 0.9,
  labelRadius: radius => radius * 0.75,
  cornerRadius: 3,
  fill: arc => (
    (arc.data && arc.data.label) ? grayScale(arc.data.label) : '#dddddd'
  ),
  fillOpacity: 1,
  stroke: '#ffffff',
  strokeWidth: 1,
  labelComponent: <ArcLabel />,
  label: null,
  padAngle: null,
  padRadius: null,
  onMouseMove: null,
  onMouseLeave: null,
};

export default function ArcSeries({
  data,
  radius,
  pieValue,
  pieSort,
  innerRadius,
  outerRadius,
  labelRadius,
  fill,
  fillOpacity,
  cornerRadius,
  padAngle,
  padRadius,
  stroke,
  strokeWidth,
  label,
  labelComponent,
  onMouseMove,
  onMouseLeave,
  ...restProps
}) {
  return (
    <g>
      <Arc
        data={data}
        pieValue={pieValue}
        pieSort={pieSort}
        outerRadius={callOrValue(outerRadius, radius)}
        innerRadius={callOrValue(innerRadius, radius)}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={cornerRadius}
        padAngle={padAngle}
        padRadius={padRadius}
        onMouseMove={onMouseLeave &&
          (datum => (event) => {
            const fraction = Math.abs(datum.startAngle - datum.endAngle) / (2 * Math.PI);
            onMouseMove({ event, data, datum: datum.data, fraction });
          })}
        onMouseLeave={onMouseLeave && (() => () => { onMouseLeave(); })}
        {...restProps}
        centroid={null}
      />
      {label && labelComponent &&
        <Arc
          data={data}
          pieValue={pieValue}
          pieSort={pieSort}
          outerRadius={callOrValue(labelRadius, radius)}
          innerRadius={callOrValue(labelRadius, radius)}
          fill="none"
          fillOpacity={0}
          stroke="none"
          strokeWidth={0}
          centroid={(centroid, arc) => {
            const [x, y] = centroid;
            const labelElement = label(arc);
            if (arc.endAngle - arc.startAngle < 0.1 || !labelElement) return null;
            return React.cloneElement(labelComponent, { x, y, arc }, labelElement);
          }}
        />}
    </g>
  );
}

ArcSeries.propTypes = propTypes;
ArcSeries.defaultProps = defaultProps;
ArcSeries.displayName = 'ArcSeries';
