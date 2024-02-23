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
import { getNumberFormatter, t, tn } from '@superset-ui/core';

import Label from 'src/components/Label';
import { Tooltip } from 'src/components/Tooltip';

type RowCountLabelProps = {
  rowcount?: number;
  limit?: number;
  loading?: boolean;
};

export default function RowCountLabel(props: RowCountLabelProps) {
  const { rowcount = 0, limit, loading } = props;
  const limitReached = rowcount === limit;
  const type =
    limitReached || (rowcount === 0 && !loading) ? 'danger' : 'default';
  const formattedRowCount = getNumberFormatter()(rowcount);
  const label = (
    <Label type={type}>
      {loading ? (
        t('Loading...')
      ) : (
        <span data-test="row-count-label">
          {tn('%s row', '%s rows', rowcount, formattedRowCount)}
        </span>
      )}
    </Label>
  );
  return limitReached ? (
    <Tooltip id="tt-rowcount-tooltip" title={<span>{t('Limit reached')}</span>}>
      {label}
    </Tooltip>
  ) : (
    label
  );
}

export type { RowCountLabelProps };
