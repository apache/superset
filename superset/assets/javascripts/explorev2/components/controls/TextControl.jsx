import React, { PropTypes } from 'react';
import { FormGroup, FormControl } from 'react-bootstrap';
import * as v from '../../validators';

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
    const value = props.value ? props.value.toString() : '';
    this.state = { value };
    this.onChange = this.onChange.bind(this);
  }
  onChange(event) {
    let value = event.target.value || '';
    this.setState({ value });

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
    return (
      <FormGroup controlId="formInlineName" bsSize="small">
        <FormControl
          type="text"
          placeholder=""
          onChange={this.onChange}
          value={this.state.value}
        />
      </FormGroup>
    );
  }
}

TextControl.propTypes = propTypes;
TextControl.defaultProps = defaultProps;
