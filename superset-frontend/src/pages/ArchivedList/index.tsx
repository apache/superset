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
import { useHistory } from 'react-router-dom';
import { useAppSelector } from 'src/views/store';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  ActionButton,
  ConfirmStatusChange,
  Select,
  Tooltip,
} from '@superset-ui/core/components';
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
import { recoveredToast } from 'src/utils/softDeleteCopy';
import { findPermission } from 'src/utils/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  ARCHIVED_TYPES,
  ARCHIVED_TYPE_CONFIG,
  type ArchivedItem,
  type ArchivedType,
} from './types';

/** Cell props shape shared by the column renderers below. */
type ArchivedCell = { row: { original: ArchivedItem } };

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

const EmptyStateRow = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px;
    color: ${theme.colorTextSecondary};
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

  // One skeleton for both row actions, so the in-flight invariant is encoded
  // once: guard -> POST -> success toast -> awaited refresh -> error toast ->
  // release. The refresh is awaited so the finally's endAction does not
  // re-enable this row's buttons while the stale row is still rendered -- a
  // keyboard user could re-activate it and get a 404 after success.
  const performRowAction = useCallback(
    async (
      item: ArchivedItem,
      verb: 'restore' | 'purge',
      onSuccess: (name: string) => void,
      failureMessage: (name: string, errMsg?: string) => string,
    ) => {
      const name = String(item[config.nameField] ?? '');
      if (!beginAction(item.uuid)) {
        return;
      }
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/${config.resource}/${item.uuid}/${verb}`,
        });
        onSuccess(name);
        await refreshData();
      } catch (error) {
        const { error: errMsg } = await getClientErrorObject(error);
        addDangerToast(failureMessage(name, errMsg));
      } finally {
        endAction(item.uuid);
      }
    },
    [
      config.resource,
      config.nameField,
      addDangerToast,
      refreshData,
      beginAction,
      endAction,
    ],
  );

  const handleRestore = useCallback(
    (item: ArchivedItem) =>
      performRowAction(
        item,
        'restore',
        name => {
          const { text, options } = recoveredToast(
            name,
            TYPE_LABELS[type],
            item.url ?? item.explore_url,
          );
          addSuccessToast(text, options);
        },
        (name, errMsg) =>
          errMsg
            ? t('Failed to restore %(name)s: %(errMsg)s', { name, errMsg })
            : t('Failed to restore %(name)s', { name }),
      ),
    [performRowAction, type, addSuccessToast],
  );

  // Permanent delete (force-purge) of an archived item — irreversible. Owner/
  // admin-gated server-side (mirrors restore). The confirmation keeps the
  // platform's type-to-confirm gate: this is the most destructive action on
  // the page, so it must not carry *less* friction than an ordinary delete.
  // The recoverable archive path is the one that earned reduced friction.
  const handlePurge = useCallback(
    (item: ArchivedItem) =>
      performRowAction(
        item,
        'purge',
        name => addSuccessToast(t('%(name)s deleted successfully', { name })),
        // A blocked purge answers 422 carrying the reason -- an alert or
        // report still referencing the object. The docs promise that reason
        // is shown, and it is the only thing telling the user what to remove
        // before retrying.
        (name, errMsg) =>
          errMsg
            ? t('Failed to delete %(name)s: %(errMsg)s', { name, errMsg })
            : t('Failed to delete %(name)s', { name }),
      ),
    [performRowAction, addSuccessToast],
  );

  const columns = useMemo<ListViewProps['columns']>(
    () => [
      {
        Cell: ({ row: { original } }: ArchivedCell) => {
          const name = String(original[config.nameField] ?? '');
          // Archived objects are not viewable in place. Verified against a
          // running instance: an archived dashboard's page 404s, and an
          // archived chart's explore page answers 200 with no chart and no
          // error — the reader is shown what looks like an empty new chart
          // rather than told anything. Neither is a preview, and the silent
          // one is the worse of the two, so no row links out until the object
          // is recovered.
          return (
            <Tooltip title={t('Recover this item to open it')}>
              <span>{name}</span>
            </Tooltip>
          );
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
        // Relative archive time, humanized by the SERVER (like
        // changed_on_delta_humanized on the sibling pages). deleted_at is
        // stamped with the server's naive-local clock, so any client-side
        // parse has to guess the server's timezone and shifts every age by
        // the server offset on non-UTC deployments -- see
        // BaseDeletedRecencyFilter for the full rationale. Sortable: id
        // stays deleted_at, which is in order_columns on all three APIs.
        Cell: ({ row: { original } }: ArchivedCell) =>
          String(original.deleted_at_delta_humanized ?? ''),
        Header: t('Archived'),
        id: 'deleted_at',
      },
      {
        // Archiving user, from changed_by. Non-sortable — there is no backend
        // deleted-by ordering.
        Cell: ({ row: { original } }: ArchivedCell) => {
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
        Cell: ({ row: { original } }: ArchivedCell) => (
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
    [config.nameField, type, handleRestore, handlePurge, inFlight],
  );

  // Default to most-recently-archived first. `deleted_at` is orderable on all
  // three list endpoints, so it's the natural sort.
  const initialSort = useMemo(() => [{ id: 'deleted_at', desc: true }], []);

  // Time-range presets send a day count; the server resolves the cutoff with
  // the same clock that stamped deleted_at. An absolute cutoff computed here
  // was wrong three ways: it was client-UTC against a server-local column
  // (shifted by the server offset), it was frozen at mount (a long-lived tab
  // drifted a day per day), and it was persisted into ?filters= as a
  // timestamp no regenerated option could ever match. A day count has none
  // of those failure modes. "All time" is the unfiltered default.
  const timeRangeOptions = useMemo(
    () => [
      { label: t('Last 7 days'), value: 7 },
      { label: t('Last 30 days'), value: 30 },
      { label: t('Last 90 days'), value: 90 },
    ],
    [],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: config.nameField,
        // The API column differs per type (slice_name / dashboard_title /
        // table_name) but ListView persists applied filters in the shared
        // ?filters= param keyed by this id. Switching Type remounts the body
        // without touching the URL, so a per-type key would come back as a
        // stale entry that the new type's filter list cannot claim -- it
        // reaches fetchData with operator undefined and rison refuses to
        // encode it, leaving the list permanently empty. A stable URL key is
        // claimed by whichever type is mounted, which then rewrites the id
        // back to its own column.
        urlDisplay: 'name',
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
        operator: config.deletedRecencyOperator,
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
  const history = useHistory();
  const roles = useAppSelector(
    state =>
      (state.user as UserWithPermissionsAndRoles | undefined)?.roles ??
      undefined,
  );

  // Offer only the types this viewer can load. The page fronts three
  // independently-gated list APIs, so a single all-or-nothing gate is the
  // wrong shape in both directions: it can hide the whole archive from
  // someone who owns archived datasets, and it can offer a type whose API
  // will answer 403. This is presentation only — each API remains the
  // enforcement point, so a hand-crafted request is still refused.
  const availableTypes = useMemo(() => {
    // Without roles we cannot say what is readable, so offer everything and
    // let the APIs answer — the same behaviour as before this filter existed.
    // Narrowing on missing information would hide the whole page instead.
    if (!roles) {
      return ARCHIVED_TYPES;
    }
    // A viewer whose roles resolve to NO readable type is refused by the
    // server-side shell admission with a 403 before this component ever
    // loads — that 403 page is the user-visible behaviour for such
    // viewers. This client-side filter exists for the partial case
    // (some-but-not-all types readable): offering a type whose API answers
    // 403 turns a permissions fact into what reads like a broken page.
    return ARCHIVED_TYPES.filter(option =>
      findPermission(
        'can_read',
        ARCHIVED_TYPE_CONFIG[option].permissionResource,
        roles,
      ),
    );
  }, [roles]);

  // Derived, not stored: the selection must track availableTypes if roles
  // resolve after mount (userReducer hydrates synchronously today, but the
  // SET_USER action exists precisely because that is not guaranteed). A
  // once-only useState initializer would leave a Select showing a value its
  // options no longer contain, fetching an API that answers 403.
  const [chosenType, setType] = useState<ArchivedType | undefined>(undefined);
  const type =
    chosenType && availableTypes.includes(chosenType)
      ? chosenType
      : availableTypes[0];

  // ListView persists sort (`sortColumn`/`sortOrder`) and pagination
  // (`pageIndex`) in the shared URL and replays them on every mount. The
  // Name column's sort id is per-type (slice_name / dashboard_title /
  // table_name), and Flask-AppBuilder *rejects* an unknown order column
  // rather than ignoring it — so a Name sort carried across a Type switch
  // 400s the new type's list and, because the bad value is in the URL,
  // stays broken across reloads. A stale pageIndex is the milder sibling:
  // page 4 of charts against a one-page dataset list shows an empty table.
  // Clearing the per-collection axes on switch lets the new type start
  // from its defaults; ?filters= survives because its keys are made
  // type-stable via `urlDisplay` in the body's filter config.
  const handleTypeChange = useCallback(
    (value: unknown) => {
      const params = new URLSearchParams(history.location.search);
      params.delete('sortColumn');
      params.delete('sortOrder');
      params.delete('pageIndex');
      history.replace({ search: params.toString() });
      setType(value as ArchivedType);
    },
    [history],
  );

  // Defence-in-depth, not a user-visible path: the server-side shell
  // admission 403s a viewer with no readable type before the SPA loads, so
  // this renders only if the client's role map and the server's admission
  // ever disagree (and TypeScript requires the guard regardless, since
  // `availableTypes[0]` is `ArchivedType | undefined`).
  if (!type) {
    return (
      <>
        <SubMenu name={t('Recently archived')} />
        <EmptyStateRow data-test="archived-no-readable-types">
          {t('You do not have permission to view any archived object types.')}
        </EmptyStateRow>
      </>
    );
  }

  return (
    <>
      <SubMenu name={t('Recently archived')} />
      <TypeSelectRow>
        <Select
          ariaLabel={t('Type')}
          value={type}
          onChange={handleTypeChange}
          options={availableTypes.map(option => ({
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
