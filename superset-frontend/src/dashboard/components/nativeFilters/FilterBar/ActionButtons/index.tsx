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
import React, { useMemo } from 'react';
import {
  css,
  DataMaskState,
  DataMaskStateWithId,
  styled,
  t,
} from '@superset-ui/core';
import Button from 'src/components/Button';
import { isNullish } from 'src/utils/common';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import { getFilterBarTestId } from '../index';

interface ActionButtonsProps {
  onApply: () => void;
  onClearAll: () => void;
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  isApplyDisabled: boolean;
}

const ActionButtonsContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;

    position: fixed;
    z-index: 100;

    // filter bar width minus 1px for border
    width: ${OPEN_FILTER_BAR_WIDTH - 1}px;
    bottom: 0;

    padding: ${theme.gridUnit * 4}px;
    padding-top: ${theme.gridUnit * 6}px;

    background: linear-gradient(transparent, white 25%);

    pointer-events: none;

    & > button {
      pointer-events: auto;
    }

    & > .filter-apply-button {
      margin-bottom: ${theme.gridUnit * 3}px;
    }

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
  `};
`;

export const ActionButtons = ({
  onApply,
  onClearAll,
  dataMaskApplied,
  dataMaskSelected,
  isApplyDisabled,
}: ActionButtonsProps) => {
  const isClearAllEnabled = useMemo(
    () =>
      Object.values(dataMaskApplied).some(
        filter =>
          !isNullish(dataMaskSelected[filter.id]?.filterState?.value) ||
          (!dataMaskSelected[filter.id] &&
            !isNullish(filter.filterState?.value)),
      ),
    [dataMaskApplied, dataMaskSelected],
  );

  return (
    <ActionButtonsContainer>
      <Button
        disabled={isApplyDisabled}
        buttonStyle="primary"
        htmlType="submit"
        className="filter-apply-button"
        onClick={onApply}
        {...getFilterBarTestId('apply-button')}
      >
        {t('Apply filters')}
      </Button>
      <Button
        disabled={!isClearAllEnabled}
        buttonStyle="link"
        buttonSize="small"
        className="filter-clear-all-button"
        onClick={onClearAll}
        {...getFilterBarTestId('clear-button')}
      >
        {t('Clear all')}
      </Button>
    </ActionButtonsContainer>
  );
};
