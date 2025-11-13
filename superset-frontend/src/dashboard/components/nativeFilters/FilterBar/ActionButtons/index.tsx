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
  DataMaskState,
  DataMaskStateWithId,
  t,
  isDefined,
} from '@superset-ui/core';
import { css, SupersetTheme, styled } from '@apache-superset/core/ui';
import { Button } from '@superset-ui/core/components';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import tinycolor from 'tinycolor2';
import { FilterBarOrientation } from 'src/dashboard/types';
import { ChartCustomizationItem } from 'src/dashboard/components/nativeFilters/ChartCustomization/types';
import { getFilterBarTestId } from '../utils';

interface ActionButtonsProps {
  width?: number;
  onApply: () => void;
  onClearAll: () => void;
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  chartCustomizationItems?: ChartCustomizationItem[];
  isApplyDisabled: boolean;
  filterBarOrientation?: FilterBarOrientation;
}

const containerStyle = (theme: SupersetTheme) => css`
  display: flex;

  && > .filter-clear-all-button {
    color: ${theme.colorTextSecondary};
    margin-left: 0;
    &:hover {
      color: ${theme.colorPrimaryText};
    }

    &[disabled],
    &[disabled]:hover {
      color: ${theme.colorTextDisabled};
    }
  }
`;

const verticalStyle = (theme: SupersetTheme, width: number, isRTL: boolean) => css`
  flex-direction: column;
  align-items: ${isRTL ? 'flex-end' : 'center'};
  position: fixed;
  z-index: 100;
  text-align: ${isRTL ? 'right' : 'center'};

  // filter bar width minus 1px for border
  width: ${width - 1}px;
  bottom: 0;

  padding: ${theme.sizeUnit * 4}px;
  padding-top: ${theme.sizeUnit * 6}px;

  background: linear-gradient(
    ${tinycolor(theme.colorBgLayout).setAlpha(0).toRgbString()},
    ${theme.colorBgContainer} 20%
  );

  & > .filter-apply-button {
    margin-bottom: ${theme.sizeUnit * 3}px;
    width: ${isRTL ? 'auto' : '100%'};
  }

  & > .filter-clear-all-button {
    text-align: ${isRTL ? 'right' : 'center'};
  }
`;

const horizontalStyle = (theme: SupersetTheme, isRTL: boolean) => css`
  align-items: center;
  ${isRTL ? 'margin-right: auto;' : 'margin-left: auto;'}
  && > .filter-clear-all-button {
    text-transform: capitalize;
    font-weight: ${theme.fontWeightNormal};
    text-align: ${isRTL ? 'right' : 'left'};
  }

  && > .filter-apply-button {
    text-align: ${isRTL ? 'right' : 'left'};
  }
`;

const ButtonsContainer = styled.div<{ isVertical: boolean; width: number; isRTL: boolean }>`
  ${({ theme, isVertical, width, isRTL }) => css`
    ${containerStyle(theme)};
    ${isVertical ? verticalStyle(theme, width, isRTL) : horizontalStyle(theme, isRTL)};
  `}
`;

const ActionButtons = ({
  width = OPEN_FILTER_BAR_WIDTH,
  onApply,
  onClearAll,
  dataMaskApplied,
  dataMaskSelected,
  isApplyDisabled,
  filterBarOrientation = FilterBarOrientation.Vertical,
  chartCustomizationItems,
}: ActionButtonsProps) => {
  // Check if locale is Persian (fa) for RTL support
  const isRTL = useMemo(() => {
    // Check document direction
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.dir === 'rtl' || 
             document.documentElement.lang === 'fa' ||
             document.documentElement.lang?.startsWith('fa');
    }
    return false;
  }, []);

  const isClearAllEnabled = useMemo(() => {
    const hasSelectedChanges = Object.entries(dataMaskSelected).some(
      ([, mask]) => {
        const hasValue = isDefined(mask?.filterState?.value);
        const hasGroupBy = isDefined(mask?.ownState?.column);
        return hasValue || hasGroupBy;
      },
    );

    const hasAppliedChanges = Object.entries(dataMaskApplied).some(
      ([, mask]) => {
        const hasValue = isDefined(mask?.filterState?.value);
        const hasGroupBy = isDefined(mask?.ownState?.column);
        return hasValue || hasGroupBy;
      },
    );

    const hasChartCustomizations = chartCustomizationItems?.some(
      item => item.customization?.column && !item.removed,
    );

    return hasSelectedChanges || hasAppliedChanges || hasChartCustomizations;
  }, [dataMaskSelected, dataMaskApplied, chartCustomizationItems]);
  const isVertical = filterBarOrientation === FilterBarOrientation.Vertical;

  return (
    <ButtonsContainer
      isVertical={isVertical}
      width={width}
      isRTL={isRTL}
      data-test="filterbar-action-buttons"
    >
      <Button
        disabled={isApplyDisabled}
        buttonStyle="primary"
        htmlType="submit"
        className="filter-apply-button"
        onClick={onApply}
        {...getFilterBarTestId('apply-button')}
      >
        {isVertical ? t('Apply filters') : t('Apply')}
      </Button>
      <Button
        disabled={!isClearAllEnabled}
        buttonStyle="link"
        className="filter-clear-all-button"
        onClick={onClearAll}
        {...getFilterBarTestId('clear-button')}
      >
        {t('Clear all')}
      </Button>
    </ButtonsContainer>
  );
};

export default ActionButtons;
