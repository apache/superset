import React from 'react';
import PropTypes from 'prop-types';
import { Checkbox } from 'react-bootstrap';
import ControlHeader from '../ControlHeader';

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

export default class CheckboxControl extends React.Component {
  onToggle() {
    this.props.onChange(!this.props.value);
  }
  render() {
    return (
      <ControlHeader
        {...this.props}
        leftNode={
          <Checkbox
            checked={this.props.value}
            onChange={this.onToggle.bind(this)}
          />
        }
      />
    );
  }
}

CheckboxControl.propTypes = propTypes;
CheckboxControl.defaultProps = defaultProps;
