import React from 'react';
import PropTypes from 'prop-types';
import ColumnTypeLabel from '../../components/ColumnTypeLabel';

const propTypes = {
  aggregate: PropTypes.object.isRequired,
  showType: PropTypes.bool,
};

export default function AggregateOption({ aggregate, showType }) {
  return (
    <div>
      {showType && <ColumnTypeLabel type="aggregate" />}
      <span className="m-r-5 option-label">
        {aggregate.aggregate_name}
      </span>
    </div>
  );
}
AggregateOption.propTypes = propTypes;
