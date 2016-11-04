import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';

const NUM_COLUMNS = 12;

const propTypes = {
  fields: PropTypes.object.isRequired,
  fieldSets: PropTypes.array.isRequired,
  fieldOverrides: PropTypes.object,
  onChange: PropTypes.func,
};

const defaultProps = {
  fieldOverrides: {},
  onChange: () => {},
};

function getFieldData(fs, fieldOverrides, fields) {
  console.log('fields', fields)
  let fieldData = fields[fs];
  if (fieldOverrides.hasOwnProperty(fs)) {
    const overrideData = fieldOverrides[fs];
    fieldData = Object.assign({}, fieldData, overrideData);
  }
  return fieldData;
}

export default function FieldSetRow({ fieldSets, fieldOverrides, fields, onChange }) {
  const colSize = NUM_COLUMNS / fieldSets.length;
  return (
    <div className="row">
      {fieldSets.map((fs) => {
        const fieldData = getFieldData(fs, fieldOverrides, fields);
        return (
          <div className={`col-lg-${colSize} col-xs-12`} key={fs}>
            <FieldSet name={fs} onChange={onChange} {...fieldData} />
          </div>
        );
      })}
    </div>
  );
}

FieldSetRow.propTypes = propTypes;
FieldSetRow.defaultProps = defaultProps;
