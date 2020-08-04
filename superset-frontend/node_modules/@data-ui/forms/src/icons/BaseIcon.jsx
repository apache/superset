import React from 'react';
import PropTypes from 'prop-types';

const SIZE_MIN = 12;
const SIZE_MAX = 97;

const IconSizePropType = PropTypes.oneOf(
  Array(SIZE_MAX - SIZE_MIN)
    .fill()
    .map((_, i) => SIZE_MIN + i),
);

const propTypes = {
  svg: PropTypes.func.isRequired,
  size: IconSizePropType,
  color: PropTypes.string,
  style: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
};

const defaultProps = {
  size: 24,
  color: '#484848',
  style: {},
};

export default function BaseIcon({ svg, color: fill, size, style }) {
  const Glyph = svg;

  const iconStyles = {
    fill,
    height: size,
    width: size,
    display: 'inline-block',
    ...style,
  };

  return <Glyph style={iconStyles} />;
}

BaseIcon.propTypes = propTypes;
BaseIcon.defaultProps = defaultProps;
