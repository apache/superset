import { styled, t } from '@superset-ui/core';
import React from 'react';
import { LineEditableTabs } from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { useDrag } from 'react-dnd';
import { REMOVAL_DELAY_SECS } from './utils';

const FILTER_WIDTH = 180;

const StyledFilterTitle = styled.span`
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
  id: string;
  isRemoved: boolean;
  getFilterTitle: (id: string) => string;
  restoreFilter: (id: string) => void;
}

export const FilterTabTitle: React.FC<FilterTabTitleProps> = ({
  id,
  isRemoved,
  getFilterTitle,
  restoreFilter,
}) => {
  const [{ isDragging }, drag, dragPreview] = useDrag({
    item: { id, type: 'FILTER' },
  });
  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        width: '100%',
        padding: '4px 8px',
        margin: '0 8px 0 0',
        marginBottom: '2px',
        borderRadius: '4px',
      }}
    >
      <StyledFilterTabTitle className={isRemoved ? 'removed' : ''}>
        <StyledFilterTitle>
          {isRemoved ? t('(Removed)') : getFilterTitle(id)}
        </StyledFilterTitle>
        {isRemoved && (
          <StyledSpan
            role="button"
            data-test="undo-button"
            tabIndex={0}
            onClick={() => restoreFilter(id)}
          >
            {t('Undo?')}
          </StyledSpan>
        )}
      </StyledFilterTabTitle>
      <div style={{ alignSelf: 'flex-end' }}>
        {isRemoved ? <></> : <StyledTrashIcon onClick={() => alert('Hi')} />}
      </div>
    </div>
  );
};

export default FilterTabTitle;
