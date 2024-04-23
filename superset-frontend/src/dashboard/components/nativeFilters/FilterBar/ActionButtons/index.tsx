// DODO was here (TODO)
import React, { useMemo } from 'react';
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
  onApply: () => void;
  onClearAll: () => void;
  dataMaskSelected: DataMaskState;
  dataMaskApplied: DataMaskStateWithId;
  isApplyDisabled: boolean;
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

// DODO commented #32683019
// const verticalStyle = (theme: SupersetTheme, width: number) => css`
//   flex-direction: column;
//   align-items: center;
//   pointer-events: none;
//   position: fixed;
//   z-index: 100;
//
//   // filter bar width minus 1px for border
//   width: ${width - 1}px;
//   bottom: 0;
//
//   padding: ${theme.gridUnit * 4}px;
//   padding-top: ${theme.gridUnit * 6}px;
//
//   background: linear-gradient(
//     ${rgba(theme.colors.grayscale.light5, 0)},
//     ${theme.colors.grayscale.light5} ${theme.opacity.mediumLight}
//   );
//
//   & > button {
//     pointer-events: auto;
//   }
//
//   & > .filter-apply-button {
//     margin-bottom: ${theme.gridUnit * 3}px;
//   }
// `;

// DODO added #32683019
const verticalStyle = (theme: SupersetTheme, width: number) => css`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;

  // filter bar width minus 1px for border
  width: ${width - 1}px;
  bottom: 0;

  padding: ${theme.gridUnit * 4}px;

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
  & > .filter-apply-button {
    &[disabled],
    &[disabled]:hover {
      color: ${theme.colors.grayscale.light1};
      background: ${theme.colors.grayscale.light3};
    }
  }
`;

const ActionButtons = ({
  width = OPEN_FILTER_BAR_WIDTH,
  onApply,
  onClearAll,
  dataMaskApplied,
  dataMaskSelected,
  isApplyDisabled,
  filterBarOrientation = FilterBarOrientation.VERTICAL,
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
  const isVertical = filterBarOrientation === FilterBarOrientation.VERTICAL;

  return (
    <div
      css={(theme: SupersetTheme) => [
        containerStyle(theme),
        isVertical ? verticalStyle(theme, width) : horizontalStyle(theme),
      ]}
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
        {/* {isVertical ? t('Apply filters') : t('Apply')} // DODO commented #32683019   */}
        {t('Apply')} {/* // DODO added #32683019 */}
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
    </div>
  );
};

export default ActionButtons;
