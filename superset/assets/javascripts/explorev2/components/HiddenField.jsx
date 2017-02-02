import React, { PropTypes } from 'react';
import { FormGroup, FormControl } from 'react-bootstrap';
import * as v from '../validators';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};

const defaultProps = {
  onChange: () => {},
};

export default class HiddenField extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    // This wouldn't be necessary but might as well
    return (
      <FormGroup controlId="formInlineName" bsSize="small">
        <FormControl
          type="hidden"
          value={this.props.value}
        />
      </FormGroup>
    );
  }
}

HiddenField.propTypes = propTypes;
HiddenField.defaultProps = defaultProps;
