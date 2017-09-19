import React from 'react';
import PropTypes from 'prop-types';
import ControlHeader from '../ControlHeader';
import Checkbox from '../../../components/Checkbox';

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

const checkboxStyle = { paddingRight: '5px' };

export default class CheckboxControl extends React.Component {
  onChange() {
    this.props.onChange(!this.props.value);
  }
  render() {
    return (
      <ControlHeader
        {...this.props}
        leftNode={
          <Checkbox
            onChange={this.onChange.bind(this)}
            style={checkboxStyle}
            checked={!!this.props.value}
          />
        }
      />
    );
  }
}

CheckboxControl.propTypes = propTypes;
CheckboxControl.defaultProps = defaultProps;
