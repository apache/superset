import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  size: PropTypes.number,
};
const defaultProps = {
  size: 25,
};

export default function Loading(props) {
  return (
    <img
      className="loading"
      alt="Loading..."
      src="/static/assets/images/loading.gif"
      style={{
        width: props.size,
        height: props.size,
        padding: 0,
        margin: 0,
      }}
    />
  );
}
Loading.propTypes = propTypes;
Loading.defaultProps = defaultProps;
