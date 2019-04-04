import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import LegendItem from './LegendItem';
import LegendLabel from './LegendLabel';
import LegendShape from './LegendShape';
import valueOrIdentity from '../util/valueOrIdentity';

Legend.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
  scale: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
    .isRequired,
  shapeWidth: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  shapeHeight: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  shapeMargin: PropTypes.string,
  labelMargin: PropTypes.string,
  itemMargin: PropTypes.string,
  direction: PropTypes.string,
  itemDirection: PropTypes.string,
  fill: PropTypes.func,
  shape: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  labelFormat: PropTypes.func,
  labelTransform: PropTypes.func,
};

const defaultStyle = {
  display: 'flex',
};

export default function Legend({
  className,
  style = defaultStyle,
  shapeStyle,
  scale,
  shape,
  domain,
  fill = valueOrIdentity,
  size = valueOrIdentity,
  labelFormat = valueOrIdentity,
  labelTransform = defaultTransform,
  shapeWidth = 15,
  shapeHeight = 15,
  shapeMargin = '2px 4px 2px 0',
  labelAlign = 'left',
  labelMargin = '0 4px',
  itemMargin = '0',
  direction = 'column',
  itemDirection = 'row',
  ...restProps
}) {
  domain = domain || scale.domain();
  const labels = domain.map(labelTransform({ scale, labelFormat }));
  return (
    <div
      className={cx('vx-legend', className)}
      style={{
        ...style,
        flexDirection: direction,
      }}
    >
      {labels.map((label, i) => {
        const { text } = label;
        return (
          <LegendItem
            key={`legend-${label}-${i}`}
            margin={itemMargin}
            flexDirection={itemDirection}
          >
            <LegendShape
              shape={shape}
              height={shapeHeight}
              width={shapeWidth}
              margin={shapeMargin}
              label={label}
              fill={fill}
              size={size}
              shapeStyle={shapeStyle}
            />
            <LegendLabel
              label={text}
              margin={labelMargin}
              align={labelAlign}
            />
          </LegendItem>
        );
      })}
    </div>
  );
}

function defaultTransform({ scale, labelFormat }) {
  return (d, i) => {
    return {
      datum: d,
      index: i,
      text: `${labelFormat(d, i)}`,
      value: scale(d),
    };
  };
}
