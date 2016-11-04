import React, { PropTypes } from 'react';
import { Checkbox } from 'react-bootstrap';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
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
      <Checkbox onChange={this.onToggle.bind(this)}>
        <ControlLabelWithTooltip label={this.props.label} description={this.props.description} />
      </Checkbox>
    );
  }
}

CheckboxField.propTypes = propTypes;
CheckboxField.defaultProps = defaultProps;
