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
import { getNumberFormatter, t } from '@superset-ui/core';

import Label from 'src/components/Label';
import { Tooltip } from 'src/components/Tooltip';

const propTypes = {
  rowcount: PropTypes.number,
  limit: PropTypes.number,
  rows: PropTypes.string,
  suffix: PropTypes.string,
  loading: PropTypes.bool,
};

const defaultProps = {
  suffix: t('rows'),
};

export default function RowCountLabel({ rowcount, limit, suffix, loading }) {
  const limitReached = rowcount === limit;
  const type =
    limitReached || (rowcount === 0 && !loading) ? 'danger' : 'default';
  const formattedRowCount = getNumberFormatter()(rowcount);
  const tooltip = (
    <span>
      {limitReached && <div>{t('Limit reached')}</div>}
      {loading ? 'Loading' : rowcount}
    </span>
  );
  return (
    <Tooltip id="tt-rowcount-tooltip" title={tooltip}>
      <Label type={type} data-test="row-count-label">
        {loading ? 'Loading...' : `${formattedRowCount} ${suffix}`}
      </Label>
    </Tooltip>
  );
}

RowCountLabel.propTypes = propTypes;
RowCountLabel.defaultProps = defaultProps;
