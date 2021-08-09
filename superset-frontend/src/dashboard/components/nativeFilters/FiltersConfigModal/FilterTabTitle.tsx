import { styled, t } from '@superset-ui/core';
import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import Icons from 'src/components/Icons';
import { REMOVAL_DELAY_SECS } from './utils';

const FILTER_TYPE = 'FILTER';
const StyledFilterTitle = styled.span`
  white-space: normal;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;
const TabTitleContainer = styled.div`
  display: flex;
  width: 100%;
  border-radius: ${({ theme }) => theme.gridUnit}px;
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
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

interface FilterTabTitleProps {
  id: string;
  isRemoved: boolean;
  index: number;
  getFilterTitle: (id: string) => string;
  restoreFilter: (id: string) => void;
  onRearrage: (itemId: string, targetIndex: number) => void;
  onRemove: (id: string) => void;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

export const FilterTabTitle: React.FC<FilterTabTitleProps> = ({
  id,
  index,
  isRemoved,
  getFilterTitle,
  restoreFilter,
  onRearrage,
  onRemove,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag, dragPreview] = useDrag({
    item: { id, type: FILTER_TYPE, index },
  });
  const [, drop] = useDrop({
    accept: FILTER_TYPE,
    collect: monitor => ({
      isOver: !!monitor.isOver(),
    }),
    hover: (item: DragItem) => {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      onRearrage(item.id, index);
      // Note: we're mutating the monitor item here.
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      // eslint-disable-next-line no-param-reassign
      item.index = hoverIndex;
    },
  });
  drag(drop(ref));
  return (
    <TabTitleContainer
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
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
        {isRemoved ? <></> : <StyledTrashIcon onClick={() => onRemove(id)} />}
      </div>
    </TabTitleContainer>
  );
};

export default FilterTabTitle;
