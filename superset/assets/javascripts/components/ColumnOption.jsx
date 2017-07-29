import React from 'react';
import PropTypes from 'prop-types';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  column: PropTypes.object.isRequired,
};

export default function ColumnOption({ column }) {
  return (
    <span>
      <span className="m-r-5 option-label">
        {column.verbose_name || column.column_name}
      </span>
      {column.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={column.description}
          label={`descr-${column.column_name}`}
        />
      }
      {column.expression && column.expression !== column.column_name &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={column.expression}
          label={`expr-${column.column_name}`}
        />
      }
    </span>);
}
ColumnOption.propTypes = propTypes;
