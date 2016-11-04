import React, { PropTypes } from 'react';
import TextField from './TextField';
import CheckboxField from './CheckboxField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import MetricList from './MetricList';
import MetricField from './MetricField';

import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const fieldMap = {
  CheckboxField,
  MetricField,
  MetricList,
  SelectField,
  TextAreaField,
  TextField,
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

export default class FieldSet extends React.PureComponent {
  render() {
    const FieldType = fieldMap[this.props.type];
    return (
      <div>
        <ControlLabelWithTooltip label={this.props.label} description={this.props.description} />
        <FieldType {...this.props} />
      </div>
    );
  }
}

FieldSet.propTypes = propTypes;
FieldSet.defaultProps = defaultProps;
