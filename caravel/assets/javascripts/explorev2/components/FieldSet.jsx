import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import { fieldTypes } from '../stores/store';

const propTypes = {
  type: PropTypes.oneOf(fieldTypes).isRequired,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.any,
};

const defaultProps = {
  choices: null,
  description: null,
  places: null,
  validators: null,
};

export default class FieldSet extends React.Component {
  renderCheckBoxField() {
    return <CheckboxField label={this.props.label} description={this.props.description} />;
  }

  renderTextAreaField() {
    return <TextAreaField label={this.props.label} description={this.props.description} />;
  }

  renderSelectField() {
    return <SelectField label={this.props.label} description={this.props.description} />;
  }

  renderTextField() {
    return <TextField label={this.props.label} description={this.props.description} />;
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
