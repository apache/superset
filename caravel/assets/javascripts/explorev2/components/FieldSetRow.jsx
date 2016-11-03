import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';
import { fields } from '../stores/store';

const propTypes = {
  fieldSets: PropTypes.array.isRequired,
  fieldOverrides: PropTypes.object,
};

const defaultProps = {
  fieldOverrides: {},
};

function getFieldData(fs, fieldOverrides) {
  let fieldData = fields[fs];
  if (fieldOverrides.hasOwnProperty(fs)) {
    const overrideData = fieldOverrides[fs];
    fieldData = Object.assign({}, fieldData, overrideData);
  }
  return fieldData;
}

export default function FieldSetRow({ fieldSets, fieldOverrides }) {
  return (
    <ul className="list-unstyled">
      {fieldSets.map((fs) => {
        const fieldData = getFieldData(fs, fieldOverrides);
        return <li key={fs}><FieldSet name={fs} {...fieldData} /></li>;
      })}
    </ul>
  );
}

FieldSetRow.propTypes = propTypes;
FieldSetRow.defaultProps = defaultProps;
