import React from 'react';
import PropTypes from 'prop-types';
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
        onClick={this.onToggle.bind(this)}
        leftNode={
          <span>
            <i
              className={`fa fa-check ${this.props.value ? 'text-primary' : 'text-transparent'}`}
              onClick={this.onToggle.bind(this)}
              style={{ border: '1px solid #aaa', borderRadius: '2px', cursor: 'pointer' }}
            />
            &nbsp;&nbsp;
          </span>
        }
      />
    );
  }
}

CheckboxControl.propTypes = propTypes;
CheckboxControl.defaultProps = defaultProps;
