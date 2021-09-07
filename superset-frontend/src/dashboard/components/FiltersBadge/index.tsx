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
import cx from 'classnames';
import Icon from 'src/components/Icon';
import Icons from 'src/components/Icons';
import DetailsPanelPopover from './DetailsPanel';
import { Pill } from './Styles';
import { Indicator } from './selectors';

export interface FiltersBadgeProps {
  appliedCrossFilterIndicators: Indicator[];
  appliedIndicators: Indicator[];
  unsetIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  onHighlightFilterSource: (path: string[]) => void;
}

const FiltersBadge = ({
  appliedCrossFilterIndicators,
  appliedIndicators,
  unsetIndicators,
  incompatibleIndicators,
  onHighlightFilterSource,
}: FiltersBadgeProps) => {
  if (
    !appliedCrossFilterIndicators.length &&
    !appliedIndicators.length &&
    !incompatibleIndicators.length &&
    !unsetIndicators.length
  ) {
    return null;
  }

  const isInactive =
    !appliedCrossFilterIndicators.length &&
    !appliedIndicators.length &&
    !incompatibleIndicators.length;

  return (
    <DetailsPanelPopover
      appliedCrossFilterIndicators={appliedCrossFilterIndicators}
      appliedIndicators={appliedIndicators}
      unsetIndicators={unsetIndicators}
      incompatibleIndicators={incompatibleIndicators}
      onHighlightFilterSource={onHighlightFilterSource}
    >
      <Pill
        className={cx(
          'filter-counts',
          !!incompatibleIndicators.length && 'has-incompatible-filters',
          !!appliedCrossFilterIndicators.length && 'has-cross-filters',
          isInactive && 'filters-inactive',
        )}
      >
        <Icon name="filter" />
        {!isInactive && (
          <span data-test="applied-filter-count">
            {appliedIndicators.length + appliedCrossFilterIndicators.length}
          </span>
        )}
        {incompatibleIndicators.length ? (
          <>
            {' '}
            <Icons.AlertSolid />
            <span data-test="incompatible-filter-count">
              {incompatibleIndicators.length}
            </span>
          </>
        ) : null}
      </Pill>
    </DetailsPanelPopover>
  );
};

export default FiltersBadge;
