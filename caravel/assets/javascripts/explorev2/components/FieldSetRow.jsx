import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';
import { fields } from '../stores/store';

const NUM_COLUMNS = 12;

const propTypes = {
  fieldSets: PropTypes.array.isRequired,
  fieldOverrides: PropTypes.object,
  onChange: PropTypes.func,
};

const defaultProps = {
  fieldOverrides: {},
  onChange: () => {},
};

function getFieldData(fs, fieldOverrides) {
  let fieldData = fields[fs];
  if (fieldOverrides.hasOwnProperty(fs)) {
    const overrideData = fieldOverrides[fs];
    fieldData = Object.assign({}, fieldData, overrideData);
  }
  return fieldData;
}

export default function FieldSetRow({ fieldSets, fieldOverrides, onChange }) {
  const colSize = NUM_COLUMNS / fieldSets.length;
  return (
    <div className="row">
      {fieldSets.map((fs) => {
        const fieldData = getFieldData(fs, fieldOverrides);
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
