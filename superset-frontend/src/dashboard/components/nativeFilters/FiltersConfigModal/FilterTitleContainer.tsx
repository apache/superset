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
import { forwardRef, useCallback, useState } from 'react';

import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  PointerSensor,
  useSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  verticalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { FilterRemoval } from './types';
import DraggableFilter from './DraggableFilter';

export const FilterTitle = styled.div`
  ${({ theme }) => `
      display: flex;
      align-items: center;
      padding: ${theme.sizeUnit * 2}px;
      border-radius: ${theme.borderRadius}px;
      cursor: pointer;
      &.active {
        color: ${theme.colorPrimaryActive};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colorPrimaryBg};
        span, .anticon {
          color: ${theme.colorIcon};
        }
      }
      &:hover {
        color: ${theme.colorPrimaryHover};
        span, .anticon {
          color: ${theme.colorPrimaryHover};
        }
      }
      &.errored div, &.errored .warning {
        color: ${theme.colorError};
      }
  `}
`;

const StyledFilterIcon = styled(Icons.FilterOutlined)`
  color: ${({ theme }) => theme.colorIcon};
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledDividerIcon = styled(Icons.PicCenterOutlined)`
  color: ${({ theme }) => theme.colorIcon};
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledWarning = styled(Icons.ExclamationCircleOutlined)`
  color: ${({ theme }) => theme.colorErrorText};
  &.anticon {
    margin-left: auto;
  }
`;

const Container = styled.div<{ isDragging: boolean }>`
  height: 100%;
  overflow-y: auto;
  ${({ isDragging }) =>
    isDragging &&
    `
    overflow: hidden;
  `}
`;

interface Props {
  getFilterTitle: (filterId: string) => string;
  onChange: (filterId: string) => void;
  currentFilterId: string;
  removedFilters: Record<string, FilterRemoval>;
  onRemove: (id: string) => void;
  restoreFilter: (id: string) => void;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  filters: string[];
  erroredFilters: string[];
}

const isFilterDivider = (id: string) => id.startsWith('NATIVE_FILTER_DIVIDER');

const FilterTitleContainer = forwardRef<HTMLDivElement, Props>(
  (
    {
      getFilterTitle,
      onChange,
      onRemove,
      restoreFilter,
      onRearrange,
      currentFilterId,
      removedFilters,
      filters,
      erroredFilters = [],
    },
    ref,
  ) => {
    const [isDragging, setIsDragging] = useState(false);

    const sensor = useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    });

    const handleDragStart = useCallback(() => {
      setIsDragging(true);
    }, []);

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        setIsDragging(false);
        const { active, over } = event;

        if (!over || active.id === over.id) {
          return;
        }

        const activeIndex = filters.findIndex(filter => filter === active.id);
        const overIndex = filters.findIndex(filter => filter === over.id);

        if (activeIndex !== -1 && overIndex !== -1) {
          onRearrange(activeIndex, overIndex);
        }
      },
      [filters, onRearrange],
    );

    const handleDragCancel = useCallback(() => {
      setIsDragging(false);
    }, []);

    const renderComponent = (id: string) => {
      const isRemoved = !!removedFilters[id];
      const isErrored = erroredFilters.includes(id);
      const isActive = currentFilterId === id;
      const classNames = [];
      if (isErrored) {
        classNames.push('errored');
      }
      if (isActive) {
        classNames.push('active');
      }
      return (
        <FilterTitle
          role="tab"
          key={`filter-title-tab-${id}`}
          onClick={() => onChange(id)}
          className={classNames.join(' ')}
        >
          <div css={{ display: 'flex', width: '100%', alignItems: 'center' }}>
            <div
              css={{
                alignItems: 'center',
                display: 'flex',
                wordBreak: 'break-all',
              }}
            >
              {isFilterDivider(id) ? (
                <StyledDividerIcon iconSize="m" />
              ) : (
                <StyledFilterIcon iconSize="m" />
              )}
              {isRemoved ? t('(Removed)') : getFilterTitle(id)}
            </div>
            {!removedFilters[id] && isErrored && (
              <StyledWarning className="warning" iconSize="s" />
            )}
            {isRemoved && (
              <span
                css={{ alignSelf: 'flex-end', marginLeft: 'auto' }}
                role="button"
                data-test="undo-button"
                tabIndex={0}
                onClick={e => {
                  e.preventDefault();
                  restoreFilter(id);
                }}
              >
                {t('Undo?')}
              </span>
            )}
          </div>
          <div css={{ alignSelf: 'flex-start', marginLeft: 'auto' }}>
            {isRemoved ? null : (
              <Icons.DeleteOutlined
                iconSize="l"
                onClick={(event: React.MouseEvent<HTMLElement>) => {
                  event.stopPropagation();
                  onRemove(id);
                }}
                alt="RemoveFilter"
              />
            )}
          </div>
        </FilterTitle>
      );
    };

    return (
      <Container
        data-test="filter-title-container"
        ref={ref}
        isDragging={isDragging}
      >
        <DndContext
          sensors={[sensor]}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={filters}
            strategy={verticalListSortingStrategy}
          >
            {filters.map((item, index) => (
              <DraggableFilter
                key={item}
                id={item}
                index={index}
                filterIds={[item]}
              >
                {renderComponent(item)}
              </DraggableFilter>
            ))}
          </SortableContext>
        </DndContext>
      </Container>
    );
  },
);

FilterTitleContainer.displayName = 'FilterTitleContainer';

export default FilterTitleContainer;
