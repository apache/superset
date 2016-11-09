import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import { fieldTypes } from '../stores/store';

const propTypes = {
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(fieldTypes).isRequired,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.any,
  onChange: React.PropTypes.func,
  value: PropTypes.oneOf([PropTypes.string, PropTypes.bool, PropTypes.array]).isRequired,
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

  renderSelectField() {
    return (
      <SelectField
        {...this.props}
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
    const selectTypes = [
      'SelectField',
      'SelectCustomMultiField',
      'SelectMultipleSortableField',
      'FreeFormSelectField',
    ];
    let field;

    if (type === 'CheckboxField') {
      field = this.renderCheckBoxField();
    } else if (selectTypes.includes(type)) {
      field = this.renderSelectField();
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
