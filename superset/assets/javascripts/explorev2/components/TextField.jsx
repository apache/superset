import React, { PropTypes } from 'react';
import { FormGroup, FormControl } from 'react-bootstrap';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  value: '',
};

export default class TextField extends React.Component {
  onChange(event) {
    this.props.onChange(this.props.name, event.target.value);
  }
  render() {
    const value = this.props.value || '';
    return (
      <FormGroup controlId="formInlineName" bsSize="small">
        <FormControl
          type="text"
          placeholder=""
          onChange={this.onChange.bind(this)}
          value={value}
        />
      </FormGroup>
    );
  }
}

TextField.propTypes = propTypes;
TextField.defaultProps = defaultProps;
