import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  size: PropTypes.number,
  position: PropTypes.oneOf(['floating', 'normal']),
};
const defaultProps = {
  size: 50,
  position: 'floating',
};

const FLOATING_STYLE = {
  padding: 0,
  margin: 0,
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
};

export default function Loading({ size, position }) {
  const style = position === 'floating' ? FLOATING_STYLE : {};
  const styleWithWidth = {
    ...style,
    size,
  };
  return (
    <img
      className="loading"
      alt="Loading..."
      src="/static/assets/images/loading.gif"
      style={styleWithWidth}
    />
  );
}

Loading.propTypes = propTypes;
Loading.defaultProps = defaultProps;
