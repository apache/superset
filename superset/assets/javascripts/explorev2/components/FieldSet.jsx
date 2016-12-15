import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import { fieldTypes } from '../stores/fields';

const propTypes = {
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(fieldTypes).isRequired,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.any,
  onChange: React.PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.array]).isRequired,
};

const defaultProps = {
  choices: null,
  description: null,
  places: null,
  validators: null,
  onChange: () => {},
};

export default class FieldSet extends React.Component {
  renderCheckBoxField() {
    return (
      <CheckboxField
        {...this.props}
      />);
  }

  renderTextAreaField() {
    return (
      <TextAreaField
        {...this.props}
      />);
  }

  renderSelectField(selectProps) {
    return (
      <SelectField
        {...this.props}
        {...selectProps}
      />);
  }

  renderTextField() {
    return (
      <TextField
        {...this.props}
      />);
  }

  render() {
    const type = this.props.type;
    const selectProps = {
      SelectCustomMultiField: { multi: true, freeForm: true },
      SelectMultipleSortableField: { multi: true, freeForm: false },
      SelectField: { multi: false, freeForm: false },
      FreeFormSelectField: { multi: false, freeForm: true },
    };
    let field;

    if (type === 'CheckboxField') {
      field = this.renderCheckBoxField();
    } else if (Object.keys(selectProps).includes(type)) {
      field = this.renderSelectField(selectProps[type]);
    } else if (['TextField', 'IntegerField'].includes(type)) {
      field = this.renderTextField();
    } else if (type === 'TextAreaField') {
      field = this.renderTextAreaField();
    }

    return field;
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
