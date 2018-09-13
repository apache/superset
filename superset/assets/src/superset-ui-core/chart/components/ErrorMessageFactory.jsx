import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
};
const defaultProps = {
  id: '',
  className: '',
};

export function createErrorMessage(type, error) {
  function ErrorMessage(props) {
    const { id, className } = props;
    return (
      <div id={id} className={className}>
        <div className="alert alert-warning" role="alert">
          <strong>ERROR</strong>
          Chart type: <code>{type}</code> &mdash;
          {error}
        </div>
      </div>
    );
  }
  ErrorMessage.propTypes = propTypes;
  ErrorMessage.defaultProps = defaultProps;

  return ErrorMessage;
}


export default ErrorMessage;
