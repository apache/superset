import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
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
  actions: React.PropTypes.object.isRequired,
};

const defaultProps = {
  choices: null,
  description: null,
  places: null,
  validators: null,
};

export class FieldSet extends React.Component {
  onChange(value) {
    this.props.actions.setFormData(this.props.name, value);
  }

  renderCheckBoxField() {
    return (
      <CheckboxField
        onChange={this.onChange.bind(this)}
        {...this.props}
      />);
  }

  renderTextAreaField() {
    return (
      <TextAreaField
        onChange={this.onChange.bind(this)}
        {...this.props}
      />);
  }

  renderSelectField() {
    return (
      <SelectField
        onChange={this.onChange.bind(this)}
        {...this.props}
      />);
  }

  renderTextField() {
    return (
      <TextField
        onChange={this.onChange.bind(this)}
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

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(FieldSet);
