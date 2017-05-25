import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, FormControl } from 'react-bootstrap';
import ControlHeader from '../ControlHeader';

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

export default class TextAreaControl extends React.Component {
  onChange(event) {
    this.props.onChange(event.target.value);
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <FormGroup controlId="formControlsTextarea">
          <FormControl
            componentClass="textarea"
            placeholder="textarea"
            onChange={this.onChange.bind(this)}
            value={this.props.value}
          />
        </FormGroup>
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;
