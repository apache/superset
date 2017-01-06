import React, { PropTypes } from 'react';

const NUM_COLUMNS = 12;

const propTypes = {
  fields: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function FieldSetRow(props) {
  const colSize = NUM_COLUMNS / props.fields.length;
  return (
    <div className="row space-2">
      {props.fields.map((field, i) => (
        <div className={`col-lg-${colSize} col-xs-12`} key={i} >
          {field}
        </div>
      ))}
    </div>
  );
}

FieldSetRow.propTypes = propTypes;
export default FieldSetRow;
