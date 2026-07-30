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
import { useCallback, useMemo, useRef, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import {
  ActionButton,
  ConfirmStatusChange,
  Select,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  GenericLink,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import SubMenu from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { recoveredToast } from 'src/utils/softDeleteCopy';
import {
  ARCHIVED_TYPES,
  ARCHIVED_TYPE_CONFIG,
  type ArchivedItem,
  type ArchivedType,
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

    /* TableCollection hides .actions with opacity and reveals them on row
       hover. Without a focus companion, tabbing lands on fully transparent
       controls — and on this page recovering and permanently deleting are
       the only actions there are. Scoped here rather than in the shared
       component, which has the same gap on every list view. */
    &:focus-within {
      opacity: 1;
    }
  `}
`;

const TYPE_LABELS: Record<ArchivedType, string> = {
  chart: t('Chart'),
  dashboard: t('Dashboard'),
  dataset: t('Dataset'),
};

interface ToastProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string, options?: { allowHtml?: boolean }) => void;
}

/** The per-row Recover + Delete-permanently actions. */
function ArchivedRowActions({
  item,
  name,
  onRestore,
  onPurge,
  busy = false,
}: {
  item: ArchivedItem;
  name: string;
  onRestore: (item: ArchivedItem) => void;
  onPurge: (item: ArchivedItem) => void;
  /** A request for this row is in flight; both actions stand down. */
  busy?: boolean;
}) {
  return (
    <StyledActions className="actions">
      <ActionButton
        label={t('Recover')}
        tooltip={t('Recover this item')}
        placement="bottom"
        icon={<Icons.RollbackOutlined iconSize="l" />}
        dataTest="archived-row-restore"
        disabled={busy}
        onClick={() => onRestore(item)}
      />
      <ConfirmStatusChange
        title={t('Delete permanently %(name)s?', { name })}
        description={t(
          "If you delete this item, you won't be able to recover it.",
        )}
        onConfirm={() => onPurge(item)}
        requireConfirmationText={false}
      >
        {confirmDelete => (
          <ActionButton
            label={t('Delete permanently')}
            tooltip={t('Delete permanently')}
            placement="bottom"
            icon={<Icons.DeleteOutlined iconSize="l" />}
            dataTest="archived-row-purge"
            disabled={busy}
            onClick={confirmDelete}
          />
        )}
      </ConfirmStatusChange>
    </StyledActions>
  );
}

/**
 * The per-type table body. Mounted with `key={type}` by the parent so the
 * `useListViewResource` state and derived columns reset cleanly on a type
 * switch. Sourced from the selected type's existing list endpoint with the
 * soft-delete `<type>_deleted_state:only` baseline filter.
 */
function ArchivedListBody({
  type,
  addDangerToast,
  addSuccessToast,
}: ToastProps & { type: ArchivedType }) {
  const config = ARCHIVED_TYPE_CONFIG[type];

  const baseFilters = useMemo(
    () => [{ id: 'id', operator: config.deletedStateOperator, value: 'only' }],
    [config.deletedStateOperator],
  );

  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
    refreshData,
  } = useListViewResource<ArchivedItem>(
    config.resource,
    TYPE_LABELS[type],
    addDangerToast,
    true,
    [],
    baseFilters,
  );

  // Restore is immediate (no confirm dialog). On success, refetch the full page
  // so the server-side count/pagination stays consistent and the row drops out;
  // on any error surface a danger toast and leave the row in place. The list
  // read is already owner-scoped, so every visible row is restorable.
  // A second activation while a request is in flight races the first: by the
  // time the retry lands the row is already restored (or purged), so the
  // server answers 404 and the user is shown a failure after a success. The
  // ref is the guard rather than the state, because state updates are async
  // and two quick clicks could both pass a state check; the state mirrors it
  // so the buttons can render disabled meanwhile.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<readonly string[]>([]);

  const beginAction = useCallback((uuid: string): boolean => {
    if (inFlightRef.current.has(uuid)) {
      return false;
    }
    inFlightRef.current.add(uuid);
    setInFlight([...inFlightRef.current]);
    return true;
  }, []);

  const endAction = useCallback((uuid: string) => {
    inFlightRef.current.delete(uuid);
    setInFlight([...inFlightRef.current]);
  }, []);

  const handleRestore = useCallback(
    async (item: ArchivedItem) => {
      const name = String(item[config.nameField] ?? '');
      if (!beginAction(item.uuid)) {
        return;
      }
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/${config.resource}/${item.uuid}/restore`,
        });
        const { text, options } = recoveredToast(
          name,
          TYPE_LABELS[type],
          item.url ?? item.explore_url,
        );
        addSuccessToast(text, options);
        refreshData();
      } catch (error) {
        addDangerToast(t('Failed to restore %(name)s', { name }));
      } finally {
        endAction(item.uuid);
      }
    },
    [
      config.resource,
      config.nameField,
      type,
      addSuccessToast,
      addDangerToast,
      refreshData,
      beginAction,
      endAction,
    ],
  );

  // Permanent delete (force-purge) of an archived item — irreversible. Owner/
  // admin-gated server-side (mirrors restore). The confirmation is a plain
  // danger modal (no type-to-confirm), per the "delete forever" design.
  const handlePurge = useCallback(
    async (item: ArchivedItem) => {
      const name = String(item[config.nameField] ?? '');
      if (!beginAction(item.uuid)) {
        return;
      }
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/${config.resource}/${item.uuid}/purge`,
        });
        addSuccessToast(t('%(name)s deleted successfully', { name }));
        refreshData();
      } catch (error) {
        addDangerToast(t('Failed to delete %(name)s', { name }));
      } finally {
        endAction(item.uuid);
      }
    },
    [
      config.resource,
      config.nameField,
      addSuccessToast,
      addDangerToast,
      refreshData,
      beginAction,
      endAction,
    ],
  );

  const columns = useMemo<ListViewProps['columns']>(
    () => [
      {
        // Chart/dashboard names link to a preview; dataset names are plain
        // text with a tooltip explaining why no preview is offered.
        Cell: ({ row: { original } }: { row: { original: ArchivedItem } }) => {
          const name = String(original[config.nameField] ?? '');
          if (config.previewable && original.url) {
            return <GenericLink to={String(original.url)}>{name}</GenericLink>;
          }
          if (!config.previewable) {
            return (
              <Tooltip
                title={t('Preview is only available for charts and dashboards')}
              >
                <span>{name}</span>
              </Tooltip>
            );
          }
          return <span>{name}</span>;
        },
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
      {
        // Relative archive time. Sortable — `deleted_at` is in order_columns
        // on all three list APIs.
        Cell: ({ row: { original } }: { row: { original: ArchivedItem } }) =>
          original.deleted_at
            ? extendedDayjs.utc(String(original.deleted_at)).fromNow()
            : '',
        Header: t('Archived'),
        id: 'deleted_at',
      },
      {
        // Archiving user, from changed_by. Non-sortable — there is no backend
        // deleted-by ordering.
        Cell: ({ row: { original } }: { row: { original: ArchivedItem } }) => {
          const by = [
            original.changed_by?.first_name,
            original.changed_by?.last_name,
          ]
            .filter(Boolean)
            .join(' ');
          return by || t('Unknown');
        },
        Header: t('Archived by'),
        id: 'archived_by',
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: { row: { original: ArchivedItem } }) => (
          <ArchivedRowActions
            item={original}
            name={String(original[config.nameField] ?? '')}
            onRestore={handleRestore}
            onPurge={handlePurge}
            busy={inFlight.includes(original.uuid)}
          />
        ),
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        size: 'sm',
      },
    ],
    [
      config.nameField,
      config.previewable,
      type,
      handleRestore,
      handlePurge,
      inFlight,
    ],
  );

  // Default to most-recently-archived first. `deleted_at` is orderable on all
  // three list endpoints, so it's the natural sort.
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
        // Charts expose an all-text search on slice_name (chart_all_text)
        // rather than a plain `ct`; dashboards/datasets accept `ct` on their
        // name column.
        operator:
          type === 'chart'
            ? FilterOperator.ChartAllText
            : FilterOperator.Contains,
      },
      {
        Header: t('Archived'),
        key: 'deleted_at',
        id: 'deleted_at',
        input: 'select',
        operator: FilterOperator.GreaterThan,
        unfilteredLabel: t('All time'),
        selects: timeRangeOptions,
      },
    ],
    [config.nameField, type, timeRangeOptions],
  );

  return (
    <ListView<ArchivedItem>
      className="archived-list-view"
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
 * Archive (Recently-Archived) view (sc-111760): find and restore soft-deleted
 * charts, dashboards, and datasets — one type at a time via the Type selector.
 */
function ArchivedList({ addDangerToast, addSuccessToast }: ToastProps) {
  const [type, setType] = useState<ArchivedType>('chart');

  return (
    <>
      <SubMenu name={t('Recently archived')} />
      <TypeSelectRow>
        <Select
          ariaLabel={t('Type')}
          value={type}
          onChange={value => setType(value as ArchivedType)}
          options={ARCHIVED_TYPES.map(option => ({
            value: option,
            label: TYPE_LABELS[option],
          }))}
        />
      </TypeSelectRow>
      <ArchivedListBody
        key={type}
        type={type}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(ArchivedList);
