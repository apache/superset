import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'react-bootstrap';

import { t } from '../../locales';
import { defaultNumberFormatter } from '../../modules/utils';
import TooltipWrapper from '../../components/TooltipWrapper';


const propTypes = {
  rowcount: PropTypes.number,
  limit: PropTypes.number,
};

const defaultProps = {
};

export default function RowCountLabel({ rowcount, limit }) {
  const limitReached = rowcount === limit;
  const bsStyle = (limitReached || rowcount === 0) ? 'warning' : 'default';
  const formattedRowCount = defaultNumberFormatter(rowcount);
  const tooltip = (
    <span>
      {limitReached &&
        <div>{t('Limit reached')}</div>}
      {rowcount}
    </span>
  );
  return (
    <TooltipWrapper label="tt-rowcount" tooltip={tooltip}>
      <Label
        bsStyle={bsStyle}
        style={{ fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}
      >
        {formattedRowCount} rows
      </Label>
    </TooltipWrapper>
  );
}

RowCountLabel.propTypes = propTypes;
RowCountLabel.defaultProps = defaultProps;
