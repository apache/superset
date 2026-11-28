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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { getNumberFormatter, NumberFormats } from '@superset-ui/core';
import {
  Button,
  Flex,
  Skeleton,
  Typography,
} from '@superset-ui/core/components';
import { ICellRendererParams } from 'ag-grid-community';
import ChildTable from './ChildTable';
import DetailBlock from './DetailBlock';
import {
  ChildGridContext,
  estimateAreaHeight,
  markerRowId,
  TreeTableContext,
  useReportHeight,
} from './TreeTableContext';
import { AreaAction, ExpandedMarker } from './types';
import { areaKey, ChildrenContext } from './useChildren';
import { EXPAND_COLUMN } from './expandColumn';
import {
  focusStop,
  FocusRouterContext,
  FULL_WIDTH_ROW,
  useRoutedArea,
} from './focusRouting';

const noop = () => {};
const formatInteger = getNumberFormatter(NumberFormats.INTEGER);

/**
 * Areas whose status speaks: a user opened the row, or pressed Retry or Load
 * more in it, and the result isn't shown yet. Kept by the chart, so an area
 * that AG Grid re-mounts keeps or drops its turn.
 */
export const AreaStatusContext = createContext<Set<string> | null>(null);

/** How long a landed result keeps its status live, so readers get its text. */
export const LIVE_HOLD_MS = 500;

/** The actions a user starts in an area; any other action supersedes them. */
const USER_ACTIONS = new Set<AreaAction>(['expand', 'retry', 'load-more']);

type ExpandedRowParams = ICellRendererParams<
  ExpandedMarker,
  unknown,
  Partial<ChildGridContext>
>;

/** The open area under a row at any level: its detail block, then its children by state. */
function ExpandedArea({
  data,
  api,
  node,
  context: gridContext,
}: ExpandedRowParams) {
  const context = useContext(TreeTableContext);
  const childrenContext = useContext(ChildrenContext);
  const ref = useRef<HTMLDivElement>(null);
  const parentIndex = data?.parentIndex ?? 0;
  const path = data?.path ?? [data?.parentKey ?? ''];
  const index = path.length - 1;
  const key = areaKey(path);
  const viewport = context?.viewport;
  const [near, setNear] = useState(!viewport);
  const mounted = near || !viewport;
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const pathRef = useRef(path);
  pathRef.current = path;
  const expectsStops = useRef(false);
  const areaHeights = context?.areaHeights;
  const keepsFocus = context?.keepsFocus;
  const gridReport =
    (index > 0 ? gridContext?.reportHeight : context?.reportHeight) ?? noop;
  const schedule = viewport?.schedule;
  const report = useCallback(
    (rowId: string, height: number) => {
      if (mountedRef.current) areaHeights?.set(key, height);
      gridReport(rowId, height);
      schedule?.();
    },
    [areaHeights, key, gridReport, schedule],
  );
  useReportHeight(ref, markerRowId(parentIndex), report);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !viewport) return undefined;
    const holdsFocus = () => {
      const active = document.activeElement;
      const row = root.parentElement?.closest(FULL_WIDTH_ROW) ?? root;
      return (
        Boolean(active && row.contains(active)) ||
        Boolean(keepsFocus?.(pathRef.current))
      );
    };
    const update = (next: boolean) => setNear(next || holdsFocus());
    update(viewport.isNear(root));
    return viewport.watch({ root, update });
  }, [viewport, keepsFocus]);
  useRoutedArea(useContext(FocusRouterContext), ref, api, () => node.rowIndex, {
    materialize: () => {
      if (mountedRef.current) return false;
      setNear(true);
      return true;
    },
    expectsStops: () => expectsStops.current,
  });
  const speaking = useContext(AreaStatusContext);
  const [live, setLive] = useState<'off' | 'live' | 'landed'>(() =>
    speaking?.has(key) ? 'live' : 'off',
  );
  const [ready, setReady] = useState(live === 'off');
  const landedText = useRef<string>();
  const awaitsRequest = useRef(false);
  useEffect(() => setReady(true), []);
  const level = context?.levels[index];
  const childLevel = context?.levels[index + 1];
  const entry = context?.entries.get(key);
  const area = childrenContext?.areas.get(key);
  const childrenName = childLevel?.name_plural || childLevel?.name || '';
  const retrying = entry?.status === 'loading' && area?.action === 'retry';
  const loading = !entry || (entry.status === 'loading' && !retrying);
  const loaded = entry?.status === 'loaded' ? entry.rows.length : 0;
  const total = entry?.total ?? 0;
  const countName = total === 1 ? childLevel?.name || '' : childrenName;
  const retryingMore =
    entry?.status === 'loaded' &&
    entry.more === 'loading' &&
    area?.action === 'retry';
  const moreError =
    retryingMore || (entry?.status === 'loaded' && entry.more === 'error');
  const superseded = Boolean(
    area && (area.origin !== 'user' || !USER_ACTIONS.has(area.action)),
  );
  const busy = Boolean(
    childLevel &&
    (loading ||
      entry?.status === 'loading' ||
      entry?.more === 'loading' ||
      area?.state === 'loading'),
  );
  const moreFocus = useRef<{ button: HTMLElement; offset: number }>();
  useLayoutEffect(
    () => () => {
      moreFocus.current = undefined;
    },
    [],
  );
  useLayoutEffect(() => {
    const pending = moreFocus.current;
    if (!pending || busy) return undefined;
    const root = ref.current;
    const finish = () => {
      if (moreFocus.current === pending) moreFocus.current = undefined;
    };
    if (!root || superseded || moreError || !loaded || loaded < total) {
      finish();
      return undefined;
    }
    const { button, offset } = pending;
    const row = Math.min(offset, loaded - 1);
    const focusAppendedRow = () => {
      const active = document.activeElement;
      if (
        active !== button &&
        (button.isConnected || active !== document.body)
      ) {
        finish();
        return true;
      }
      const grid = root.querySelector('.ag-root-wrapper');
      const cells = grid?.querySelectorAll<HTMLElement>(
        `[row-id="row-${row}"] .ag-cell:not([col-id="${EXPAND_COLUMN}"])`,
      );
      const cell = Array.from(cells ?? []).find(
        candidate => candidate.closest('.ag-root-wrapper') === grid,
      );
      if (!cell) return false;
      focusStop(cell, { preventScroll: true });
      finish();
      return true;
    };
    if (focusAppendedRow()) return undefined;
    const observer = new MutationObserver(() => {
      if (focusAppendedRow()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      finish();
    };
  }, [busy, loaded, moreError, superseded, total]);
  const loadingText = t('Loading %s', childrenName);
  const errorLine = t("Couldn't load %s —", childrenName);
  let text: string[] = [];
  if (!childLevel) text = [];
  else if (loading || retrying) text = [loadingText];
  else if (entry.status === 'empty')
    text = [
      entry.inRange
        ? t('No %s in the selected range', childrenName)
        : t('No %s', childrenName),
    ];
  else if (entry.status === 'error') text = ['', errorLine];
  else
    text = [
      loaded < total
        ? t('%(loaded)s of %(total)s %(children)s', {
            loaded: formatInteger(loaded),
            total: formatInteger(total),
            children: countName,
          })
        : t('%(total)s %(children)s', {
            total: formatInteger(total),
            children: countName,
          }),
      moreError && !retryingMore ? errorLine : '',
      retryingMore ? loadingText : '',
    ];
  const textKey = text.join('|');
  useEffect(() => {
    if (live !== 'live' || !superseded) return;
    speaking?.delete(key);
    setLive('off');
  }, [live, superseded, key, speaking]);
  useEffect(() => {
    if (live !== 'live' || !ready || superseded) return;
    if (busy) {
      awaitsRequest.current = false;
      return;
    }
    if (awaitsRequest.current) return;
    speaking?.delete(key);
    landedText.current = textKey;
    setLive('landed');
  }, [live, ready, superseded, busy, key, speaking, textKey]);
  useEffect(() => {
    if (live !== 'landed') return undefined;
    const timer = setTimeout(() => setLive('off'), LIVE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [live]);
  const speak = () => {
    speaking?.add(key);
    awaitsRequest.current = true;
    setLive('live');
  };
  if (!context || !data) return null;
  const parentEntry =
    index > 0 ? context.entries.get(areaKey(path.slice(0, -1))) : undefined;
  const row =
    index > 0
      ? parentEntry?.rows[parentIndex]
      : (context.data[parentIndex] ?? {});
  expectsStops.current = Boolean(
    childLevel &&
    (entry?.status === 'loaded' || entry?.status === 'error' || retrying),
  );
  const ariaLive =
    !superseded &&
    (live === 'live' || (live === 'landed' && landedText.current === textKey))
      ? 'polite'
      : 'off';
  const [stateText, errorText, pendingText] = ready ? text : [];
  let action = null;
  if (entry?.status === 'error' || retrying) {
    action = (
      <Button
        key="retry"
        buttonStyle="link"
        loading={retrying}
        onClick={event => {
          childrenContext?.holdFocus(path, event.currentTarget);
          speak();
          context.retry(path);
        }}
      >
        {t('Retry')}
      </Button>
    );
  } else if (entry?.status === 'loaded' && (moreError || loaded < total)) {
    action = (
      <Button
        key="more"
        buttonStyle="link"
        loading={entry.more === 'loading' || area?.state === 'loading'}
        onClick={event => {
          event.currentTarget.focus({ preventScroll: true });
          const pending = { button: event.currentTarget, offset: loaded };
          moreFocus.current = pending;
          // A final page removes the button before AG Grid mounts the new cells.
          childrenContext?.holdFocus(
            path,
            pending.button,
            () => moreFocus.current === pending,
          );
          speak();
          childrenContext?.loadMore(path);
        }}
      >
        {moreError ? t('Retry') : t('Load more')}
      </Button>
    );
  }
  let body = null;
  if (loading)
    body = (
      <div className="loading" aria-busy="true">
        <Skeleton active />
      </div>
    );
  else if (entry?.status === 'loaded')
    body = (
      <ChildTable levelIndex={index + 1} entry={entry} parentPath={path} />
    );
  return (
    // AG Grid's full-width row has no cell of its own; this element is it.
    // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div ref={ref} role="gridcell" className="tree-table-open-area">
      <div
        className="tree-table-area-status"
        data-state={area?.state}
        data-action={area?.action}
        data-origin={area?.origin}
        data-loaded={area?.loaded}
        data-total={area?.total}
      />
      {mounted ? (
        <Flex vertical gap="middle">
          {level && row && level.detail_fields.length > 0 && (
            <DetailBlock
              level={level}
              row={row}
              columns={context.buildColumns(
                level.detail_fields,
                parentEntry?.colnames ?? context.colnames,
                parentEntry?.coltypes ?? context.coltypes,
              )}
            />
          )}
          {childLevel && (
            <Flex
              vertical
              gap="middle"
              // A fieldset brings form semantics and default browser styling.
              // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="group"
              className="tree-table-child-group"
              aria-label={t('%(children)s of %(parent)s %(id)s', {
                children: childrenName,
                parent: level?.name,
                id: path[index],
              })}
            >
              {body}
              <Flex align="center" wrap gap="small">
                <Flex
                  className="tree-table-status"
                  align="center"
                  wrap
                  gap="small"
                  aria-live={ariaLive}
                  aria-atomic="true"
                >
                  {stateText ? (
                    <Typography.Text type="secondary">
                      {stateText}
                    </Typography.Text>
                  ) : null}
                  {errorText ? (
                    <Typography.Text type="danger">{errorText}</Typography.Text>
                  ) : null}
                  {pendingText ? (
                    <Typography.Text type="secondary">
                      {pendingText}
                    </Typography.Text>
                  ) : null}
                </Flex>
                {action}
              </Flex>
            </Flex>
          )}
        </Flex>
      ) : (
        <div style={{ height: estimateAreaHeight(path, context) }} />
      )}
    </div>
  );
}

/**
 * AG Grid 36 draws an embedded full-width row in the left, centre and right
 * sections; the area renders in the centre one only. Every grid of the tree
 * uses this renderer for its open rows.
 */
export default function ExpandedRow(params: ExpandedRowParams) {
  return params.pinned ? null : <ExpandedArea {...params} />;
}
