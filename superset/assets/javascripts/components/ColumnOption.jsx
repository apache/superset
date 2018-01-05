import React from 'react';
import PropTypes from 'prop-types';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  column: PropTypes.object.isRequired,
  showType: PropTypes.bool,
};
const defaultProps = {
  showType: false,
};

export default function ColumnOption({ column, showType }) {
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
      {showType &&
        <span className="text-muted">{column.type}</span>
      }
    </span>);
}
ColumnOption.propTypes = propTypes;
ColumnOption.defaultProps = defaultProps;
