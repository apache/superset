import { styled, t } from '@superset-ui/core';
import React from 'react';
import { LineEditableTabs } from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { useDrag } from 'react-dnd';
import { REMOVAL_DELAY_SECS } from './utils';

const FILTER_WIDTH = 180;

const StyledFilterTitle = styled.span`
  width: ${FILTER_WIDTH}px;
  white-space: normal;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const StyledFilterTabTitle = styled.span`
  transition: color ${({ theme }) => theme.transitionTiming}s;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  @keyframes tabTitleRemovalAnimation {
    0%,
    90% {
      opacity: 1;
    }
    95%,
    100% {
      opacity: 0;
    }
  }

  &.removed {
    color: ${({ theme }) => theme.colors.warning.dark1};
    transform-origin: top;
    animation-name: tabTitleRemovalAnimation;
    animation-duration: ${REMOVAL_DELAY_SECS}s;
  }
`;
const StyledSpan = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.dark1};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

interface Props {
  getFilterTitle: (id: string) => string;
  isRemoved: boolean;
  filterId: string;
  restoreFilter: (id: string) => void;
  renderFilterConfig: React.ReactNode;
}

interface FilterTabTitleProps {
  getFilterTitle: (id: string) => string;
  isRemoved: boolean;
  filterId: string;
  restoreFilter: (id: string) => void;
}
const FilterTabTitle: React.FC<FilterTabTitleProps> = ({
  filterId,
  isRemoved,
  getFilterTitle,
  restoreFilter,
}) => (
  <StyledFilterTabTitle className={isRemoved ? 'removed' : ''}>
    <StyledFilterTitle>
      {isRemoved ? t('(Removed)') : getFilterTitle(filterId)}
    </StyledFilterTitle>
    {isRemoved && (
      <StyledSpan
        role="button"
        data-test="undo-button"
        tabIndex={0}
        onClick={() => restoreFilter(filterId)}
      >
        {t('Undo?')}
      </StyledSpan>
    )}
  </StyledFilterTabTitle>
);

const FilterTabPane: React.FC<Props> = ({
  filterId,
  isRemoved,
  getFilterTitle,
  restoreFilter,
  renderFilterConfig,
}) => {
  const [collected, drag, dragPreview] = useDrag({
    item: { type: 'FILTER', filterId },
  });
  return (
    // <div ref={drag}>
    <LineEditableTabs.TabPane
      tab={
        <FilterTabTitle
          filterId={filterId}
          isRemoved={isRemoved}
          getFilterTitle={filterId => getFilterTitle(filterId)}
          restoreFilter={restoreFilter}
        />
      }
      key={filterId}
      closeIcon={isRemoved ? <></> : <StyledTrashIcon />}
    >
      {
        /* @ts-ignore */
        renderFilterConfig(filterId)
      }
    </LineEditableTabs.TabPane>
    // </div>
  );
};

export default FilterTabPane;
