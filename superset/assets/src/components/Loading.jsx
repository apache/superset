import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  size: PropTypes.number,
};
const defaultProps = {
  size: 50,
};

export default function Loading(props) {
  return (
    <img
      className="loading"
      alt="Loading..."
      src="/static/assets/images/loading.gif"
      style={{
        width: Math.min(props.size, 50),
        // height is auto
        padding: 0,
        margin: 0,
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

Loading.propTypes = propTypes;
Loading.defaultProps = defaultProps;
