import React from 'react';
import PropTypes from 'prop-types';
import ControlHeader from '../ControlHeader';
import Checkbox from '../../../components/Checkbox';

const propTypes = {
  value: PropTypes.bool,
  label: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  value: false,
  onChange: () => {},
};

const checkboxStyle = { paddingRight: '5px' };

export default class CheckboxControl extends React.Component {
  onChange() {
    this.props.onChange(!this.props.value);
  }
  renderCheckbox() {
    return (
      <Checkbox
        onChange={this.onChange.bind(this)}
        style={checkboxStyle}
        checked={!!this.props.value}
      />);
  }
  render() {
    if (this.props.label) {
      return (
        <ControlHeader
          {...this.props}
          leftNode={this.renderCheckbox()}
        />
      );
    }
    return this.renderCheckbox();
  }
}
CheckboxControl.propTypes = propTypes;
CheckboxControl.defaultProps = defaultProps;
