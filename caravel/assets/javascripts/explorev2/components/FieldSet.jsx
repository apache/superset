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
    let html;

    if (type === 'CheckboxField') {
      html = this.renderCheckBoxField();
    } else if (type === 'SelectField' ||
               type === 'SelectCustomMultiField' ||
               type === 'SelectMultipleSortableField' ||
               type === 'FreeFormSelectField') {
      html = this.renderSelectField();
    } else if (type === 'TextField' || type === 'IntegerField') {
      html = this.renderTextField();
    } else if (type === 'TextAreaField') {
      this.renderTextAreaField();
    }

    return html;
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
