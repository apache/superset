import React from 'react';
import PropTypes from 'prop-types';

import ColumnTypeLabel from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  column: PropTypes.object.isRequired,
  showType: PropTypes.bool,
};
const defaultProps = {
  showType: false,
};

export default function ColumnOption({ column, showType }) {
  const hasExpression = column.expression && column.expression !== column.column_name;
  return (
    <span>
      {showType && <ColumnTypeLabel type={hasExpression ? 'expression' : column.type} />}
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
      {hasExpression &&
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
ColumnOption.defaultProps = defaultProps;
