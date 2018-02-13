import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, FormControl } from 'react-bootstrap';
import * as v from '../../validators';
import ControlHeader from '../ControlHeader';

const propTypes = {
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  isFloat: PropTypes.bool,
  isInt: PropTypes.bool,
  disabled: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
  onFocus: () => {},
  value: '',
  isInt: false,
  isFloat: false,
  disabled: false,
};

export default class TextControl extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(event) {
    let value = event.target.value || '';

    // Validation & casting
    const errors = [];
    if (this.props.isFloat) {
      const error = v.numeric(value);
      if (error) {
        errors.push(error);
      } else {
        value = parseFloat(value);
      }
    }
    if (this.props.isInt) {
      const error = v.integer(value);
      if (error) {
        errors.push(error);
      } else {
        value = parseInt(value, 10);
      }
    }
    this.props.onChange(value, errors);
  }
  render() {
    const value = this.props.value ? this.props.value.toString() : '';
    return (
      <div>
        <ControlHeader {...this.props} />
        <FormGroup controlId="formInlineName" bsSize="small">
          <FormControl
            type="text"
            placeholder=""
            onChange={this.onChange}
            onFocus={this.props.onFocus}
            value={value}
            disabled={this.props.disabled}
          />
        </FormGroup>
      </div>
    );
  }
}

TextControl.propTypes = propTypes;
TextControl.defaultProps = defaultProps;
