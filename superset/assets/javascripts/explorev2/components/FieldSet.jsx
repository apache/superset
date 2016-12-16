import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';

const fieldMap = {
  TextField,
  CheckboxField,
  TextAreaField,
  SelectField,
};
const fieldTypes = Object.keys(fieldMap);

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
    PropTypes.array]),
};

const defaultProps = {
  onChange: () => {},
};

export default class FieldSet extends React.Component {

  render() {
    const FieldClass = fieldMap[this.props.type];
    return (
      <div>
        <FieldClass {...this.props} />
      </div>
    );
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
