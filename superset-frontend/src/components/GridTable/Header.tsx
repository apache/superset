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
import { useCallback, useEffect, useState } from 'react';
import type { Column, GridApi, SortDirection } from 'ag-grid-community';

import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';

import { PIVOT_COL_ID } from './constants';
import { HeaderMenu } from './HeaderMenu';

interface Params {
  enableFilterButton?: boolean;
  enableSorting?: boolean;
  displayName: string;
  column: Column;
  api: GridApi;
  progressSort: (multiSort?: boolean) => void;
}

const HeaderCell = styled.div`
  display: flex;
  flex: 1;
  &[role='button'] {
    cursor: pointer;
  }
`;

const HeaderCellSort = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

const SortSeqLabel = styled.span`
  position: absolute;
  right: 0;
`;

const HeaderAction = styled.div`
  display: none;
  position: absolute;
  right: 0;
  &.main {
    flex-direction: row;
    justify-content: center;
    width: 100%;
  }
  & .ant-dropdown-trigger {
    cursor: context-menu;
    padding: ${({ theme }) => theme.sizeUnit * 2}px;
    background-color: var(--ag-background-color);
    box-shadow: 0 0 2px var(--ag-chip-border-color);
    border-radius: 50%;
    &:hover {
      box-shadow: 0 0 4px ${({ theme }) => theme.colorBorderSecondary};
    }
  }
`;

const IconPlaceholder = styled.div`
  position: absolute;
  top: 0;
`;

export const Header: React.FC<Params> = ({
  enableFilterButton,
  enableSorting,
  displayName,
  progressSort,
  column,
  api,
}: Params) => {
  const theme = useTheme();
  const colId = column.getColId();
  const pinnedLeft = column.isPinnedLeft();
  const pinnedRight = column.isPinnedRight();
  const [invisibleColumns, setInvisibleColumns] = useState<Column[]>([]);
  const [currentSort, setCurrentSort] = useState<SortDirection>(null);
  const [sortIndex, setSortIndex] = useState<number | null>();
  const onSort = useCallback(
    (event: React.MouseEvent) => {
      progressSort(event.shiftKey);
    },
    [progressSort],
  );
  const onVisibleChange = useCallback(
    (isVisible: boolean) => {
      if (isVisible) {
        setInvisibleColumns(
          api.getColumns()?.filter(c => !c.isVisible()) || [],
        );
      }
    },
    [api],
  );

  const syncSortState = useCallback(() => {
    const hasMultiSort = api
      .getAllDisplayedColumns()
      .some(c => c.getColId() !== colId && c.getSort() !== null);
    setCurrentSort(column.getSort() ?? null);
    setSortIndex(hasMultiSort ? column.getSortIndex() : null);
  }, [api, column, colId]);

  useEffect(() => {
    column.addEventListener('columnStateUpdated', syncSortState);

    return () => {
      if (api.isDestroyed()) return;
      column.removeEventListener('columnStateUpdated', syncSortState);
    };
  }, [column, syncSortState]);

  return (
    <>
      {colId !== PIVOT_COL_ID && (
        <HeaderCell
          tabIndex={0}
          className="ag-header-cell-label"
          {...(enableSorting && {
            role: 'button',
            onClick: onSort,
            title: t(
              'To enable multiple column sorting, hold down the ⇧ Shift key while clicking the column header.',
            ),
          })}
        >
          <div className="ag-header-cell-text">{displayName}</div>
          {enableSorting && (
            <HeaderCellSort>
              <Icons.Sort iconSize="xxl" />
              <IconPlaceholder>
                {currentSort === 'asc' && (
                  <Icons.SortAsc
                    iconSize="xxl"
                    iconColor={theme.colorPrimary}
                  />
                )}
                {currentSort === 'desc' && (
                  <Icons.SortDesc
                    iconSize="xxl"
                    iconColor={theme.colorPrimary}
                  />
                )}
              </IconPlaceholder>
              {typeof sortIndex === 'number' && (
                <SortSeqLabel>{sortIndex + 1}</SortSeqLabel>
              )}
            </HeaderCellSort>
          )}
        </HeaderCell>
      )}
      {enableFilterButton && colId && api && (
        <HeaderAction
          className={`customHeaderAction${
            colId === PIVOT_COL_ID ? ' main' : ''
          }`}
        >
          {colId && (
            <HeaderMenu
              colId={colId}
              api={api}
              pinnedLeft={pinnedLeft}
              pinnedRight={pinnedRight}
              invisibleColumns={invisibleColumns}
              isMain={colId === PIVOT_COL_ID}
              onVisibleChange={onVisibleChange}
            />
          )}
        </HeaderAction>
      )}
    </>
  );
};
