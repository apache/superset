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
import { useCallback, useMemo, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Select, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import SubMenu from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  DELETED_TYPES,
  DELETED_TYPE_CONFIG,
  type DeletedItem,
  type DeletedType,
} from './types';

const PAGE_SIZE = 25;

const TypeSelectRow = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    width: 240px;
  `}
`;

const StyledActions = styled.div`
  ${({ theme }) => `
    color: ${theme.colorIcon};
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    .action-button {
      cursor: pointer;
    }
  `}
`;

const TYPE_LABELS: Record<DeletedType, string> = {
  chart: t('Chart'),
  dashboard: t('Dashboard'),
  dataset: t('Dataset'),
};

interface ToastProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

/**
 * The per-type table body. Mounted with `key={type}` by the parent so the
 * `useListViewResource` state and derived columns reset cleanly on a type
 * switch (review H2). Sourced from the selected type's existing list endpoint
 * with the `<type>_deleted_state:only` baseline filter.
 */
function DeletedListBody({
  type,
  addDangerToast,
  addSuccessToast,
}: ToastProps & { type: DeletedType }) {
  const config = DELETED_TYPE_CONFIG[type];

  const baseFilters = useMemo(
    () => [{ id: 'id', operator: config.deletedStateOperator, value: 'only' }],
    [config.deletedStateOperator],
  );

  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
    refreshData,
  } = useListViewResource<DeletedItem>(
    config.resource,
    TYPE_LABELS[type],
    addDangerToast,
    true,
    [],
    baseFilters,
  );

  // T012/T013: restore is immediate (no confirm dialog). On success, refetch
  // the full page so the server-side count/pagination stays consistent and the
  // row drops out; on any error (403/404/422) surface a danger toast and leave
  // the row in place. The list read is already owner-scoped, so every visible
  // row is restorable — no client-side gating (H1).
  const handleRestore = useCallback(
    async (item: DeletedItem) => {
      const name = String(item[config.nameField] ?? '');
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/${config.resource}/${item.uuid}/restore`,
        });
        addSuccessToast(t('Restored %(name)s', { name }));
        refreshData();
      } catch (error) {
        addDangerToast(t('There was an issue restoring %(name)s', { name }));
      }
    },
    [
      config.resource,
      config.nameField,
      addSuccessToast,
      addDangerToast,
      refreshData,
    ],
  );

  const columns = useMemo<ListViewProps['columns']>(
    () => [
      {
        accessor: config.nameField,
        Header: t('Name'),
        id: config.nameField,
      },
      {
        Cell: () => TYPE_LABELS[type],
        Header: t('Type'),
        id: 'type',
        disableSortBy: true,
      },
      // Backing column for the Time-range filter + default sort. Hidden here;
      // US3 (T022) turns it into a visible relative-time "Deleted" column.
      {
        accessor: 'deleted_at',
        Header: t('Deleted'),
        id: 'deleted_at',
        hidden: true,
      },
      {
        Cell: ({ row: { original } }: { row: { original: DeletedItem } }) => (
          <StyledActions className="actions">
            <Tooltip
              id="restore-action-tooltip"
              title={t('Restore')}
              placement="bottom"
            >
              <span
                data-test="deleted-row-restore"
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={() => handleRestore(original)}
              >
                <Icons.ReloadOutlined iconSize="l" />
              </span>
            </Tooltip>
          </StyledActions>
        ),
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        size: 'sm',
      },
    ],
    [config.nameField, type, handleRestore],
  );

  // Default to most-recently-deleted first. `deleted_at` is now orderable on
  // all three list endpoints (T014-T016), so it replaces the US1 `changed_on`
  // fallback (C1).
  const initialSort = useMemo(() => [{ id: 'deleted_at', desc: true }], []);

  // Time-range presets map to a `deleted_at` greater-than cutoff. FAB exposes
  // `gt` (not `ge`) for a DateTime column; for a relative window the half-open
  // boundary is equivalent. "All time" is the unfiltered default.
  const timeRangeOptions = useMemo(() => {
    const cutoff = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString();
    };
    return [
      { label: t('Last 7 days'), value: cutoff(7) },
      { label: t('Last 30 days'), value: cutoff(30) },
      { label: t('Last 90 days'), value: cutoff(90) },
    ];
  }, []);

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: config.nameField,
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Deleted'),
        key: 'deleted_at',
        id: 'deleted_at',
        input: 'select',
        operator: FilterOperator.GreaterThan,
        unfilteredLabel: t('All time'),
        selects: timeRangeOptions,
      },
    ],
    [config.nameField, timeRangeOptions],
  );

  return (
    <ListView<DeletedItem>
      className="deleted-list-view"
      columns={columns}
      filters={filters}
      data={resourceCollection}
      count={resourceCount}
      pageSize={PAGE_SIZE}
      fetchData={fetchData}
      refreshData={refreshData}
      addSuccessToast={addSuccessToast}
      addDangerToast={addDangerToast}
      loading={loading}
      initialSort={initialSort}
      emptyState={{
        title: t('No archived items'),
        image: 'empty.svg',
      }}
    />
  );
}

/**
 * Recently-Deleted (Archive) view (sc-111760): find and restore soft-deleted
 * charts, dashboards, and datasets — one type at a time via the Type selector.
 */
function DeletedList({ addDangerToast, addSuccessToast }: ToastProps) {
  const [type, setType] = useState<DeletedType>('chart');

  return (
    <>
      <SubMenu name={t('Recently deleted')} />
      <TypeSelectRow>
        <Select
          ariaLabel={t('Type')}
          value={type}
          onChange={value => setType(value as DeletedType)}
          options={DELETED_TYPES.map(option => ({
            value: option,
            label: TYPE_LABELS[option],
          }))}
        />
      </TypeSelectRow>
      <DeletedListBody
        key={type}
        type={type}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(DeletedList);
