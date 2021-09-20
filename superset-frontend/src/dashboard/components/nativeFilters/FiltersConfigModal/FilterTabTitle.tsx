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
import { styled, t } from '@superset-ui/core';
import React, { useRef } from 'react';
import { DropTargetMonitor, useDrag, useDrop, XYCoord } from 'react-dnd';
import Icons from 'src/components/Icons';
import { REMOVAL_DELAY_SECS } from './utils';

interface TabTitleContainerProps {
  readonly isDragging: boolean;
}
const FILTER_TYPE = 'FILTER';
const StyledFilterTitle = styled.span`
  white-space: normal;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;
const TabTitleContainer = styled.div<TabTitleContainerProps>`
  ${({ theme, isDragging }) => `
    display: flex;
    width: 100%;
    border-radius:  ${theme.borderRadius}px;
    opacity: ${isDragging ? 0.5 : 1};
    padding-top: ${theme.gridUnit}px;
    padding-bottom: ${theme.gridUnit}px;
    padding-left: ${2 * theme.gridUnit}px;
    &:hover {
      transition: all 0.3s;
      span, .anticon {
        color: ${theme.colors.primary.dark1};
      }
    }
`}
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
  const [{ isDragging }, drag] = useDrag({
    item: { id, type: FILTER_TYPE, index },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  const [, drop] = useDrop({
    accept: FILTER_TYPE,
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
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
    <TabTitleContainer ref={ref} isDragging={isDragging}>
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
      <div css={{ alignSelf: 'flex-end' }}>
        {isRemoved ? (
          <></>
        ) : (
          <StyledTrashIcon
            onClick={event => {
              event.stopPropagation();
              onRemove(id);
            }}
          />
        )}
      </div>
    </TabTitleContainer>
  );
};

export default FilterTabTitle;
