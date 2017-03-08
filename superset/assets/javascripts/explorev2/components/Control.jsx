import React, { PropTypes } from 'react';
import ControlHeader from './ControlHeader';

import CheckboxControl from './controls/CheckboxControl';
import FilterControl from './controls/FilterControl';
import HiddenControl from './controls/HiddenControl';
import SelectControl from './controls/SelectControl';
import TextAreaControl from './controls/TextAreaControl';
import TextControl from './controls/TextControl';

const controlMap = {
  CheckboxControl,
  FilterControl,
  HiddenControl,
  SelectControl,
  TextAreaControl,
  TextControl,
};
const controlTypes = Object.keys(controlMap);

const propTypes = {
  actions: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(controlTypes).isRequired,
  label: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.array,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.array]),
};

const defaultProps = {
  renderTrigger: false,
  validators: [],
  validationErrors: [],
};

export default class Control extends React.PureComponent {
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
    this.props.actions.setControlValue(this.props.name, value, validationErrors);
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
    const ControlType = controlMap[this.props.type];
    const divStyle = this.props.hidden ? { display: 'none' } : null;
    return (
      <div style={divStyle}>
        <ControlHeader
          label={this.props.label}
          description={this.props.description}
          renderTrigger={this.props.renderTrigger}
          validationErrors={this.props.validationErrors}
          rightNode={this.props.rightNode}
        />
        <ControlType
          onChange={this.onChange}
          {...this.props}
        />
      </div>
    );
  }
}

Control.propTypes = propTypes;
Control.defaultProps = defaultProps;
