import React, { PropTypes } from 'react';

// todo: implement components for each of these types
export const FIELD_TYPES = [
  'SelectField',
  'SelectMultipleSortableField',
  'CheckboxField',
  'FreeFormSelectField',
  'IntegerField', // can be same as text field, with integer validation
  'TextAreaField',
  'TextField'
];

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

export default class FieldSet extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>{this.props.label}</div>
    );
  }
}
