import React, { PropTypes } from 'react';
import { Checkbox } from 'react-bootstrap';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.bool,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: false,
  label: null,
  description: null,
  onChange: () => {},
};

export default class CheckboxField extends React.Component {
  onToggle() {
    this.props.onChange(this.props.name);
  }
  render() {
    return (
      <Checkbox
        inline
        checked={this.props.value}
        onChange={this.onToggle.bind(this)}
      >
        <ControlLabelWithTooltip label={this.props.label} description={this.props.description} />
      </Checkbox>
    );
  }
}

CheckboxField.propTypes = propTypes;
CheckboxField.defaultProps = defaultProps;
