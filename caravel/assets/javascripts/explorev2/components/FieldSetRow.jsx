import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';
import { fields } from '../stores/store';

const propTypes = {
  fieldSets: PropTypes.array.isRequired,
};

export default function FieldSetRow() {
  return (
    <ul className="list-unstyled">
      {this.props.fieldSets.map((fs) => <li key={fs}><FieldSet {...fields[fs]} /></li>)}
    </ul>
  );
}

FieldSetRow.propTypes = propTypes;
