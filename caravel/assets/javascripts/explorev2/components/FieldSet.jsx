import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';

const fieldTypes = [
  'CheckboxField',
  'SelectField',
  'SelectCustomMultiField',
  'SelectMultipleSortableField',
  'TextField',
  'IntegerField',
];

const propTypes = {
  type: PropTypes.oneOf(fieldTypes).isRequired,
  label: PropTypes.string.isRequired,
  defaultChoice: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.array,
};

const defaultProps = {
  choices: null,
  description: null,
  places: null,
  validators: null,
};

export default class FieldSet extends React.Component {
  renderCheckBoxField() {
    return (<CheckboxField label={this.props.label} description={this.props.description} />);
  }

  renderTextAreaField() {
    return (<TextAreaField label={this.props.label} description={this.props.description} />);
  }

  renderSelectField() {
    return (<SelectField label={this.props.label} description={this.props.description} />);
  }

  renderTextField() {
    return (<TextField label={this.props.label} description={this.props.description} />);
  }

  render() {
    let html;

    switch (this.props.type) {
      case 'CheckboxField':
        html = this.renderCheckBoxField();
        break;
      case 'SelectField':
      case 'SelectCustomMultiField':
      case 'SelectMultipleSortableField':
        html = this.renderSelectField();
        break;
      case 'TextField':
      case 'IntegerField':
        html = this.renderTextField();
        break;
      default:
        html = <div></div>;
    }
    return html;
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
