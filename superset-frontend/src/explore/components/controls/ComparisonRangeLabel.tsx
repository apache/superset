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
import { isEqual } from 'lodash';
import {
  BinaryAdhocFilter,
  ComparisonTimeRangeType,
  css,
  SimpleAdhocFilter,
  t,
  fetchTimeRange,
} from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';

const isTimeRangeEqual = (
  left: BinaryAdhocFilter[],
  right: BinaryAdhocFilter[],
) => isEqual(left, right);

export const ComparisonRangeLabel = () => {
  const [labels, setLabels] = useState<string[]>([]);
  const currentTimeRangeFilters = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_filters?.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );
  const customTimeRangeComparisonFilters = useSelector<
    RootState,
    BinaryAdhocFilter[]
  >(
    state =>
      state.explore.form_data.adhoc_custom?.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );
  const shift = useSelector<RootState, ComparisonTimeRangeType>(
    state => state.explore.form_data.time_comparison,
  );

  useEffect(() => {
    if (shift === ComparisonTimeRangeType.Custom) {
      const promises = customTimeRangeComparisonFilters?.map(filter =>
        fetchTimeRange(filter.comparator, filter.subject),
      );
      Promise.all(promises).then(res => {
        setLabels(res.map(r => r.value ?? ''));
      });
    }
  }, [customTimeRangeComparisonFilters, shift]);

  useEffect(() => {
    if (shift !== ComparisonTimeRangeType.Custom) {
      const promises = currentTimeRangeFilters?.map(filter =>
        fetchTimeRange(
          filter.comparator,
          filter.subject,
          shift || ComparisonTimeRangeType.InheritedRange,
        ),
      );
      Promise.all(promises).then(res => {
        setLabels(res.map(r => r.value ?? ''));
      });
    }
  }, [currentTimeRangeFilters, shift]);

  return labels.length ? (
    <>
      <ControlHeader label={t('Actual range for comparison')} />
      {labels.map((label, index) => (
        <div
          css={theme => css`
            font-size: ${theme.typography.sizes.m}px;
            color: ${theme.colors.grayscale.dark1};
          `}
          key={index}
        >
          {label}
          {index < labels.length - 1 ? ',' : ''}
        </div>
      ))}
    </>
  ) : null;
};
