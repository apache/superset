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
import { useMemo } from 'react';
import {
  css,
  DataMaskState,
  DataMaskStateWithId,
  t,
  isDefined,
  SupersetTheme,
} from '@superset-ui/core';
import Button from 'src/components/Button';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import { rgba } from 'emotion-rgba';
import { FilterBarOrientation } from 'src/dashboard/types';
import { getFilterBarTestId } from '../utils';

interface ActionButtonsProps {
  width?: number;
  onClearAll: () => void;
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  filterBarOrientation?: FilterBarOrientation;
}

const containerStyle = (theme: SupersetTheme) => css`
  display: flex;

  && > .filter-clear-all-button {
    color: ${theme.colors.grayscale.base};
    margin-left: 0;
    &:hover {
      color: ${theme.colors.primary.dark1};
    }

    &[disabled],
    &[disabled]:hover {
      color: ${theme.colors.grayscale.light1};
    }
  }
`;

const verticalStyle = (theme: SupersetTheme, width: number) => css`
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  position: fixed;
  z-index: 100;

  // filter bar width minus 1px for border
  width: ${width - 1}px;
  bottom: 0;

  padding: ${theme.gridUnit * 4}px;
  padding-top: ${theme.gridUnit * 6}px;

  background: linear-gradient(
    ${rgba(theme.colors.grayscale.light5, 0)},
    ${theme.colors.grayscale.light5} ${theme.opacity.mediumLight}
  );

  & > button {
    pointer-events: auto;
  }
`;

const horizontalStyle = (theme: SupersetTheme) => css`
  align-items: center;
  margin-left: auto;
  && > .filter-clear-all-button {
    text-transform: capitalize;
    font-weight: ${theme.typography.weights.normal};
  }
`;

const ActionButtons = ({
  width = OPEN_FILTER_BAR_WIDTH,
  onClearAll,
  dataMaskApplied,
  dataMaskSelected,
  filterBarOrientation = FilterBarOrientation.Vertical,
}: ActionButtonsProps) => {
  const isClearAllEnabled = useMemo(
    () =>
      Object.values(dataMaskApplied).some(
        filter =>
          isDefined(dataMaskSelected[filter.id]?.filterState?.value) ||
          (!dataMaskSelected[filter.id] &&
            isDefined(filter.filterState?.value)),
      ),
    [dataMaskApplied, dataMaskSelected],
  );
  const isVertical = filterBarOrientation === FilterBarOrientation.Vertical;

  return (
    <div
      css={(theme: SupersetTheme) => [
        containerStyle(theme),
        isVertical ? verticalStyle(theme, width) : horizontalStyle(theme),
      ]}
      data-test="filterbar-action-buttons"
    >
      <Button
        disabled={!isClearAllEnabled}
        buttonStyle="link"
        buttonSize="small"
        className="filter-clear-all-button"
        onClick={onClearAll}
        {...getFilterBarTestId('clear-button')}
      >
        {t('Reset All')}
      </Button>
    </div>
  );
};

export default ActionButtons;
