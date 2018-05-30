import React from 'react';
import PropTypes from 'prop-types';

const NUM_COLUMNS = 12;

const propTypes = {
  controls: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function ControlSetRow(props) {
  const colSize = NUM_COLUMNS / props.controls.length;
  return (
    <div className="row space-1">
      {props.controls.map((control, i) => (
        <div className={`col-lg-${colSize} col-xs-12`} key={i} >
          {control}
        </div>
      ))}
    </div>
  );
}

ControlSetRow.propTypes = propTypes;
export default ControlSetRow;
