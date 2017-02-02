import React, { PropTypes } from 'react';
import { FormControl } from 'react-bootstrap';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};

const defaultProps = {
  onChange: () => {},
};

export default class HiddenField extends React.PureComponent {
  render() {
    // This wouldn't be necessary but might as well
    return <FormControl type="hidden" value={this.props.value} />;
  }
}

HiddenField.propTypes = propTypes;
HiddenField.defaultProps = defaultProps;
