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

import React, { useCallback } from 'react';
import { css, useTheme } from '@superset-ui/core';
import { CrossFilterIndicator } from 'src/dashboard/components/nativeFilters/selectors';
import { useDispatch } from 'react-redux';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { FilterBarOrientation } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import CrossFilterTag from './CrossFilterTag';
import CrossFilterTitle from './CrossFilterTitle';

const CrossFilter = (props: {
  filter: CrossFilterIndicator;
  orientation: FilterBarOrientation;
  last?: boolean;
}) => {
  const { filter, orientation, last } = props;
  const theme = useTheme();
  const dispatch = useDispatch();

  const handleHighlightFilterSource = useCallback(
    (path?: string[]) => {
      if (path) {
        dispatch(setDirectPathToChild(path));
      }
    },
    [dispatch],
  );

  const handleRemoveCrossFilter = (chartId: number) => {
    dispatch(
      updateDataMask(chartId, {
        extraFormData: {
          filters: [],
        },
        filterState: {
          value: null,
          selectedValues: null,
        },
      }),
    );
  };

  return (
    <div
      key={`${filter.name}${filter.emitterId}`}
      css={css`
        ${orientation === FilterBarOrientation.VERTICAL
          ? `
            display: block;
            margin-bottom: ${theme.gridUnit * 4}px;
          `
          : `
            display: flex;
          `}
      `}
    >
      <CrossFilterTitle
        title={filter.name}
        orientation={orientation || FilterBarOrientation.HORIZONTAL}
        onHighlightFilterSource={() => handleHighlightFilterSource(filter.path)}
      />
      {(filter.column || filter.value) && (
        <CrossFilterTag
          filter={filter}
          orientation={orientation}
          removeCrossFilter={handleRemoveCrossFilter}
        />
      )}
      {last && (
        <span
          data-test="cross-filters-divider"
          css={css`
            ${orientation === FilterBarOrientation.HORIZONTAL
              ? `
                width: 1px;
                height: 22px;
                margin-left: ${theme.gridUnit * 4}px;
                margin-right: ${theme.gridUnit}px;
              `
              : `
                width: 100%;
                height: 1px;
                display: block;
                margin-bottom: ${theme.gridUnit * 4}px;
                margin-top: ${theme.gridUnit * 4}px;
            `}
            background: ${theme.colors.grayscale.light2};
          `}
        />
      )}
    </div>
  );
};

export default CrossFilter;
