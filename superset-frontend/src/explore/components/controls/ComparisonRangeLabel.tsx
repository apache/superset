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

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ComparisonTimeRangeType,
  css,
  SimpleAdhocFilter,
  t,
  fetchTimeRange,
} from '@superset-ui/core';
import { RootState } from 'src/views/store';
import { Tooltip } from 'src/components/Tooltip';

export const ComparisonRangeLabel = () => {
  const [label, setLabel] = useState('');
  const currentTimeRange = useSelector<RootState, string>(
    state =>
      state.explore.form_data.adhoc_filters.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      )[0]?.comparator,
  );
  const shift = useSelector<RootState, ComparisonTimeRangeType>(
    state => state.explore.form_data.time_comparison,
  );

  useEffect(() => {
    if (shift === ComparisonTimeRangeType.Custom) {
      setLabel('');
    }
  }, [shift]);

  useEffect(() => {
    if (shift !== ComparisonTimeRangeType.Custom) {
      fetchTimeRange(currentTimeRange, 'col', shift).then(res => {
        setLabel(res.value ?? '');
      });
    }
  }, [currentTimeRange, shift]);

  return label ? (
    <Tooltip title={t('Actual time range for comparison')}>
      <span
        css={theme => css`
          font-size: ${theme.typography.sizes.m}px;
          color: ${theme.colors.grayscale.base};
        `}
      >
        {label}
      </span>
    </Tooltip>
  ) : null;
};
