import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import FilterField from './FilterField';
import ControlHeader from './ControlHeader';

const fieldMap = {
  TextField,
  CheckboxField,
  TextAreaField,
  SelectField,
  FilterField,
};
const fieldTypes = Object.keys(fieldMap);

const propTypes = {
  actions: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(fieldTypes).isRequired,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.array,
  validationErrors: PropTypes.array,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.array]),
};

const defaultProps = {
  validators: [],
  validationErrors: [],
};

export default class FieldSet extends React.PureComponent {
  constructor(props) {
    super(props);
    this.validate = this.validate.bind(this);
    this.onChange = this.onChange.bind(this);
  }
  onChange(value, errors) {
    let validationErrors = this.validate(value);
    if (errors && errors.length > 0) {
      validationErrors = validationErrors.concat(errors);
    }
    this.props.actions.setFieldValue(this.props.name, value, validationErrors);
  }
  validate(value) {
    const validators = this.props.validators;
    const validationErrors = [];
    if (validators && validators.length > 0) {
      validators.forEach(f => {
        const v = f(value);
        if (v) {
          validationErrors.push(v);
        }
      });
    }
    return validationErrors;
  }
  render() {
    const FieldType = fieldMap[this.props.type];
    return (
      <div>
        <ControlHeader
          label={this.props.label}
          description={this.props.description}
          validationErrors={this.props.validationErrors}
        />
        <FieldType
          onChange={this.onChange}
          {...this.props}
        />
      </div>
    );
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
