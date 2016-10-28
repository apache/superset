import React, { PropTypes } from 'react';
import { Checkbox, FormGroup, ControlLabel, FieldGroup, FormControl } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  type: PropTypes.oneOf(FIELD_TYPES).isRequired,
  label: PropTypes.string.isRequired,
  defaultChoice: PropTypes.string.isRequired,
  choices: PropTypes.arrayOf(PropTypes.array),
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.array,
}

const defaultProps = {
  choices: null,
  description: null,
  places: null,
  validators: null,
}

function ControlLabelWithTooltip({ label, description }) {
  return (
    <ControlLabel>
      {label} &nbsp;
      {description &&
        <InfoTooltipWithTrigger label={label} tooltip={description} />
      }
    </ControlLabel>
  );
}

function CheckboxField({ label, description }) {
  return (
    <Checkbox name="" value="">
      <ControlLabelWithTooltip label={label} description={description} />
    </Checkbox>
  )
}

function SelectField({ label, description }) {
  return (
    <FormGroup controlId="formControlsSelect">
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl componentClass="select" placeholder="select">
        <option value="select">select</option>
        <option value="other">...</option>
      </FormControl>
    </FormGroup>
  )
}

function TextAreaFeild({ label, description }) {
  return (
    <FormGroup controlId="formControlsTextarea">
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl componentClass="textarea" placeholder="textarea" />
    </FormGroup>
  );
}

function TextField({ label, description }) {
  return (
    <FormGroup controlId="formInlineName">
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl type="text" placeholder="" />
    </FormGroup>
  );
}

export default class FieldSet extends React.Component {
  renderCheckBoxField() {
    return(<CheckboxField label={this.props.label} description={this.props.description} />);
  }

  renderTextAreaField() {
    return(<TextAreaField label={this.props.label} description={this.props.description} />);
  }

  renderSelectField() {
    return(<SelectField label={this.props.label} description={this.props.description} />);
  }

  renderTextField() {
    return(<TextField label={this.props.label} description={this.props.description} />);
  }

  render() {
    const { label, description, type } = this.props;
    let html;

    switch (type) {
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
