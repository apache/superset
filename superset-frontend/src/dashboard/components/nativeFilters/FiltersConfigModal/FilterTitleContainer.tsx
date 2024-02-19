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
import React, { forwardRef } from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { FilterRemoval } from './types';
import DraggableFilter from './DraggableFilter';

export const FilterTitle = styled.div`
  ${({ theme }) => `
      display: flex;
      align-items: center;
      padding: ${theme.gridUnit * 2}px;
      width: 100%;
      border-radius: ${theme.borderRadius}px;
      cursor: pointer;
      &.active {
        color: ${theme.colors.grayscale.dark1};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.secondary.light4};
        span, .anticon {
          color: ${theme.colors.grayscale.dark1};
        }
      }
      &:hover {
        color: ${theme.colors.primary.light1};
        span, .anticon {
          color: ${theme.colors.primary.light1};
        }
      }
      &.errored div, &.errored .warning {
        color: ${theme.colors.error.base};
      }
  `}
`;

const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

const StyledWarning = styled(Icons.Warning)`
  color: ${({ theme }) => theme.colors.error.base};
  &.anticon {
    margin-left: auto;
  }
`;

const Container = styled.div`
  height: 100%;
  overflow-y: auto;
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
          <div css={{ display: 'flex', width: '100%' }}>
            <div
              css={{
                alignItems: 'center',
                display: 'flex',
                wordBreak: 'break-all',
              }}
            >
              {isRemoved ? t('(Removed)') : getFilterTitle(id)}
            </div>
            {!removedFilters[id] && isErrored && (
              <StyledWarning className="warning" />
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
              <StyledTrashIcon
                onClick={event => {
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

    const renderFilterGroups = () => {
      const items: React.ReactNode[] = [];
      filters.forEach((item, index) => {
        items.push(
          <DraggableFilter
            key={index}
            onRearrange={onRearrange}
            index={index}
            filterIds={[item]}
          >
            {renderComponent(item)}
          </DraggableFilter>,
        );
      });
      return items;
    };

    return (
      <Container data-test="filter-title-container" ref={ref}>
        {renderFilterGroups()}
      </Container>
    );
  },
);

export default FilterTitleContainer;
