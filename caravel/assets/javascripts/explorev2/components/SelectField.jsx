import React, { PropTypes } from 'react';
import { FormGroup, FormControl } from 'react-bootstrap';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';
import { slugify } from '../../modules/utils';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
};

export default class SelectField extends React.Component {
  onChange(opt) {
    this.props.onChange(this.props.name, opt.target.value);
  }
  render() {
    return (
      <FormGroup controlId={`formControlsSelect-${slugify(this.props.label)}`}>
        <ControlLabelWithTooltip
          label={this.props.label}
          description={this.props.description}
        />
        <FormControl
          componentClass="select"
          placeholder="select"
          onChange={this.onChange.bind(this)}
        >
          <option value="select">select</option>
          <option value="other">...</option>
        </FormControl>
      </FormGroup>
    );
  }
}

SelectField.propTypes = propTypes;
SelectField.defaultProps = defaultProps;
