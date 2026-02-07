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
import { t } from '@apache-superset/core';
import {
  DataMaskState,
  DataMaskStateWithId,
  isDefined,
  ChartCustomization,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { css, SupersetTheme, styled } from '@apache-superset/core/ui';
import { Button, Tooltip, Icons, Flex } from '@superset-ui/core/components';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';
import tinycolor from 'tinycolor2';
import { FilterBarOrientation } from 'src/dashboard/types';
import { getFilterBarTestId } from '../utils';

interface ActionButtonsProps {
  width?: number;
  onApply: () => void;
  onClearAll: () => void;
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  chartCustomizationItems?: (ChartCustomization | ChartCustomizationDivider)[];
  isApplyDisabled: boolean;
  filterBarOrientation?: FilterBarOrientation;
  hasOutOfScopeRequiredFilters?: boolean;
}

const ButtonsContainer = styled.div<{ isVertical: boolean; width: number }>`
  ${({ theme, isVertical, width }) => css`
    display: flex;

    ${isVertical
      ? css`
          flex-direction: column;
          align-items: center;
          position: fixed;
          z-index: 100;
          width: ${width - 1}px;
          bottom: 0;
          padding: ${theme.sizeUnit * 4}px;
          padding-top: ${theme.sizeUnit * 6}px;
          background: linear-gradient(
            ${tinycolor(theme.colorBgLayout).setAlpha(0).toRgbString()},
            ${theme.colorBgContainer} 20%
          );
        `
      : css`
          align-items: center;
          margin-left: auto;
        `}
  `}
`;

const applyButtonStyle = (theme: SupersetTheme, isVertical: boolean) => css`
  ${isVertical &&
  css`
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const clearAllButtonStyle = (theme: SupersetTheme, isVertical: boolean) => css`
  && {
    color: ${theme.colorTextSecondary};
    margin-left: 0;

    &:hover {
      color: ${theme.colorPrimaryText};
    }

    &[disabled],
    &[disabled]:hover {
      color: ${theme.colorTextDisabled};
    }

    ${!isVertical &&
    css`
      text-transform: capitalize;
      font-weight: ${theme.fontWeightNormal};
    `}
  }
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
  hasOutOfScopeRequiredFilters = false,
}: ActionButtonsProps) => {
  const isVertical = filterBarOrientation === FilterBarOrientation.Vertical;

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

    const hasChartCustomizations = chartCustomizationItems?.some(item => {
      if (item.removed) return false;
      const mask = dataMaskApplied[item.id] || dataMaskSelected[item.id];
      const hasValue = isDefined(mask?.filterState?.value);
      const hasGroupBy = isDefined(mask?.ownState?.column);
      return hasValue || hasGroupBy;
    });

    return hasSelectedChanges || hasAppliedChanges || hasChartCustomizations;
  }, [dataMaskSelected, dataMaskApplied, chartCustomizationItems]);

  return (
    <ButtonsContainer
      isVertical={isVertical}
      width={width}
      data-test="filterbar-action-buttons"
    >
      <Button
        disabled={isApplyDisabled}
        buttonStyle="primary"
        htmlType="submit"
        css={(theme: SupersetTheme) => applyButtonStyle(theme, isVertical)}
        onClick={onApply}
        {...getFilterBarTestId('apply-button')}
      >
        {isVertical ? t('Apply filters') : t('Apply')}
      </Button>
      <Flex>
        <Button
          disabled={!isClearAllEnabled}
          buttonStyle="link"
          css={(theme: SupersetTheme) => clearAllButtonStyle(theme, isVertical)}
          onClick={onClearAll}
          {...getFilterBarTestId('clear-button')}
        >
          {t('Clear all')}
        </Button>
        {hasOutOfScopeRequiredFilters && (
          <Tooltip
            title={t(
              'Some required filters on other tabs have values and will not be cleared',
            )}
          >
            <Icons.InfoCircleOutlined
              iconSize="s"
              css={(theme: SupersetTheme) => css`
                margin-left: ${theme.sizeUnit}px;
              `}
            />
          </Tooltip>
        )}
      </Flex>
    </ButtonsContainer>
  );
};

export default ActionButtons;
