/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'react-bootstrap';
import { getNumberFormatter } from '@superset-ui/number-format';
import { t } from '@superset-ui/translation';

import TooltipWrapper from '../../components/TooltipWrapper';

const propTypes = {
  rowcount: PropTypes.number,
  limit: PropTypes.number,
  rows: PropTypes.string,
  suffix: PropTypes.string,
};

const defaultProps = {
  suffix: t('rows'),
};

export default function RowCountLabel({ rowcount, limit, suffix }) {
  const limitReached = rowcount === limit;
  const bsStyle = limitReached || rowcount === 0 ? 'danger' : 'default';
  const formattedRowCount = getNumberFormatter()(rowcount);
  const tooltip = (
    <span>
      {limitReached && <div>{t('Limit reached')}</div>}
      {rowcount}
    </span>
  );
  return (
    <TooltipWrapper label="tt-rowcount" tooltip={tooltip}>
      <Label
        bsStyle={bsStyle}
        style={{ fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}
      >
        {formattedRowCount} {suffix}
      </Label>
    </TooltipWrapper>
  );
}

RowCountLabel.propTypes = propTypes;
RowCountLabel.defaultProps = defaultProps;
