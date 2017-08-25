import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, FormControl } from 'react-bootstrap';
import * as v from '../../validators';
import ControlHeader from '../ControlHeader';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  isFloat: PropTypes.bool,
  isInt: PropTypes.bool,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  value: '',
  isInt: false,
  isFloat: false,
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
            value={value}
          />
        </FormGroup>
      </div>
    );
  }
}

TextControl.propTypes = propTypes;
TextControl.defaultProps = defaultProps;
