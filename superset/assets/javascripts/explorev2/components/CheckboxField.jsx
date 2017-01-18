import React, { PropTypes } from 'react';
import { Checkbox } from 'react-bootstrap';

const propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.bool,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: false,
  onChange: () => {},
};

export default class CheckboxField extends React.Component {
  onToggle() {
    this.props.onChange(!this.props.value);
  }
  render() {
    return (
      <Checkbox
        checked={this.props.value}
        onChange={this.onToggle.bind(this)}
      />
    );
  }
}

CheckboxField.propTypes = propTypes;
CheckboxField.defaultProps = defaultProps;
