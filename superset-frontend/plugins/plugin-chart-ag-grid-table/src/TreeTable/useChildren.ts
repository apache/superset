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
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { isEqual } from 'lodash-es';
import { buildQueryObject } from '@superset-ui/core';
import normalizeTreeFormData from './normalizeTreeFormData';
import buildChildrenQuery, {
  DEFAULT_CHILDREN_SHOWN,
} from './buildChildrenQuery';
import { parentDateFilters } from './buildQuery';
import { childRangeApplies } from './childFilters';
import { appendMore, keyOf, loadingEntry, toEntries } from './childrenState';
import fetchTreeTableData from './fetchTreeTableData';
import fetchChildren from './fetchChildren';
import {
  AreaAction,
  AreaOrigin,
  AreaState,
  ChildrenEntry,
  ChildSort,
  TreeTableChildRequest,
  TreeTableFormData,
  TreeLevel,
} from './types';

export interface UseChildrenParams {
  formData: TreeTableFormData;
  linkDateFormats?: TreeTableChildRequest['linkDateFormats'];
  /** Distinct keys of the level-1 rows on the page that can open. */
  pageKeys: string[];
  /** Open level-1 keys. */
  expanded: Set<string>;
  /** The page rows; a new array means the chart got new data. */
  data: unknown;
  /** Rows at level 2 and below toggled by the user, as `areaKey(path)`. */
  childToggled?: Set<string>;
  /** "Expand all to" level: rows above it with a key are open unless toggled. */
  expandLevel?: number;
}

export type ChildSorts = Map<number, [string, boolean]>;

export interface UseChildrenResult {
  /** Children of each parent row, as `areaKey(parent path)`. */
  entries: Map<string, ChildrenEntry>;
  /** Open rows at level 2 and below, as `areaKey(path)`. */
  childExpanded: Set<string>;
  open: (path: string[]) => void;
  close: (path: string[]) => void;
  retry: (path: string[]) => void;
  loadMore: (path: string[]) => void;
  /** The sort of each child level, by level index. */
  sorts: ChildSorts;
  setSort: (level: number, sort: ChildSort, fromPath: string[]) => void;
  expandAll: (level: number, keys: string[], childKeys: string[]) => void;
  record: (key: string, action: AreaAction, origin?: AreaOrigin) => void;
  reset: () => void;
  areas: Map<string, AreaState>;
}

export const areaKey = (path: string[]) => JSON.stringify(path);

const pathOf = (key: string) => JSON.parse(key) as string[];

/** What the open areas need from the chart beyond `TreeTableContext`. */
export interface ChildrenContextValue {
  loadMore: (path: string[]) => void;
  sorts: ChildSorts;
  setSort: (level: number, sort: ChildSort, fromPath: string[]) => void;
  areas: Map<string, AreaState>;
  /** Remember the button so focus can recover if it goes away. */
  holdFocus: (
    path: string[],
    button: HTMLElement,
    deferRestore?: () => boolean,
  ) => void;
}

export const ChildrenContext = createContext<ChildrenContextValue | null>(null);

const NO_CHILDREN = new Set<string>();
const CHILD_REQUEST_CONCURRENCY = 4;

export function createChildTransport(): typeof fetchTreeTableData {
  const queue = new Map<symbol, () => void>();
  let active = 0;
  const drain = () => {
    while (active < CHILD_REQUEST_CONCURRENCY && queue.size) {
      const [key, start] = queue.entries().next().value!;
      queue.delete(key);
      start();
    }
  };
  return params =>
    new Promise((resolve, reject) => {
      const { signal } = params;
      const rejectAborted = () =>
        reject(new DOMException('Aborted', 'AbortError'));
      if (signal?.aborted) {
        rejectAborted();
        return;
      }
      const key = Symbol();
      const abortQueued = () => {
        queue.delete(key);
        rejectAborted();
      };
      signal?.addEventListener('abort', abortQueued, { once: true });
      queue.set(key, () => {
        signal?.removeEventListener('abort', abortQueued);
        active += 1;
        fetchTreeTableData(params)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            drain();
          });
      });
      drain();
    });
}

interface AreaRecord {
  action: AreaAction;
  origin: AreaOrigin;
}

/**
 * A one-parent request (open, Retry, Load more). It is also the area's action
 * token: a collapse drops it, so its answer is ignored even if the abort is not.
 */
interface Single {
  controller: AbortController;
  kind: 'open' | 'retry' | 'more';
}

/**
 * The request that answers a key, with each key's action epoch when it was
 * sent. A collapse moves the key's epoch on, so a reopen sends its own request
 * and ownership prevents the earlier answer from overwriting the new request.
 */
interface Owner {
  replaced?: boolean;
  force: boolean;
  epochs: Map<string, number>;
  checks: Map<string, Single>;
}

/** A refresh that reloads open rows level by level, from level 2 down. */
interface RefreshRun {
  force: boolean;
  /** The level index loading or next to load. */
  level: number;
  sent: boolean;
}

const EXPAND_ALL: AreaRecord = { action: 'expand-all', origin: 'expand-all' };
const USER_EXPAND: AreaRecord = { action: 'expand', origin: 'user' };

/**
 * What the parent query filters on, with dashboard native filters,
 * cross-filters and time overrides from `extra_form_data` folded in. A refresh
 * keeps it; a filter or time range change does not.
 */
export function parentFilters(formData: TreeTableFormData) {
  const { filters, extras, time_range, since, until, granularity } =
    buildQueryObject(normalizeTreeFormData(formData));
  return {
    datasource: formData.datasource,
    filters,
    extras,
    time_range,
    since,
    until,
    granularity,
  };
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every(key => b.has(key));

/**
 * Drop the entries below a reloaded parent for rows that are no longer in its
 * answer.
 */
function pruneLeft(
  entries: Map<string, ChildrenEntry>,
  loaded: Map<string, ChildrenEntry>,
  idColumn: string,
) {
  const kept = new Map<string, Set<string>>();
  loaded.forEach((entry, key) => {
    if (entry.status === 'loaded' || entry.status === 'empty')
      kept.set(
        key,
        new Set(
          entry.rows
            .map(row => keyOf(row[idColumn]))
            .filter((rowKey): rowKey is string => rowKey !== undefined),
        ),
      );
  });
  if (!kept.size) return entries;
  [...entries.keys()].forEach(key => {
    const path = pathOf(key);
    for (let length = 1; length < path.length; length += 1) {
      const rows = kept.get(areaKey(path.slice(0, length)));
      if (rows && !rows.has(path[length])) {
        entries.delete(key);
        return;
      }
    }
  });
  return entries;
}

/**
 * The visible rows of each level as paths (level 1: the page; deeper: the rows
 * of loaded child tables whose parent rows are all open), and the open rows at
 * level 2 and below.
 */
function walkRows(
  levels: TreeLevel[],
  pageKeys: string[],
  expanded: Set<string>,
  entries: Map<string, ChildrenEntry>,
  toggled: Set<string>,
  expandLevel: number,
) {
  const visible: string[][][] = [pageKeys.map(key => [key])];
  const open = new Set<string>();
  for (let index = 1; index < levels.length; index += 1) {
    const level = levels[index];
    const rows: string[][] = [];
    visible[index - 1].forEach(parent => {
      const parentOpen =
        index === 1 ? expanded.has(parent[0]) : open.has(areaKey(parent));
      if (!parentOpen) return;
      const seen = new Set<string>();
      entries.get(areaKey(parent))?.rows.forEach(row => {
        const key = keyOf(row[level.id_column]);
        if (key === undefined || seen.has(key)) return;
        seen.add(key);
        const path = [...parent, key];
        rows.push(path);
        const pathKey = areaKey(path);
        if (expandLevel > index ? !toggled.has(pathKey) : toggled.has(pathKey))
          open.add(pathKey);
      });
    });
    visible.push(rows);
  }
  return { visible, open };
}

/**
 * Children at every level: one batch per level on a first open, Retry, Load
 * more, a sort per level, reset, refresh and filter changes level by level,
 * "Expand all to" any level; and the state of every open area.
 */
export default function useChildren({
  formData,
  linkDateFormats,
  pageKeys,
  expanded,
  data,
  childToggled = NO_CHILDREN,
  expandLevel = 0,
}: UseChildrenParams): UseChildrenResult {
  const [fetchChildData] = useState(createChildTransport);
  const [entries, setEntries] = useState<Map<string, ChildrenEntry>>(
    () => new Map(),
  );
  const [sorts, setSortsState] = useState<ChildSorts>(() => new Map());
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [records, setRecords] = useState<Map<string, AreaRecord>>(
    () => new Map(),
  );
  const [refreshStep, setRefreshStep] = useState(0);
  const levels = useMemo(() => formData.levels ?? [], [formData.levels]);
  const walked = useMemo(
    () =>
      walkRows(levels, pageKeys, expanded, entries, childToggled, expandLevel),
    [levels, pageKeys, expanded, entries, childToggled, expandLevel],
  );
  const shownOpen = useRef(walked.open);
  if (!sameSet(shownOpen.current, walked.open)) shownOpen.current = walked.open;
  const childExpanded = shownOpen.current;
  const { visible } = walked;
  const isOpen = useCallback(
    (key: string) => {
      const path = pathOf(key);
      return path.length === 1 ? expanded.has(path[0]) : childExpanded.has(key);
    },
    [expanded, childExpanded],
  );
  const latest = useRef({
    formData,
    linkDateFormats,
    pageKeys,
    expanded,
    entries,
    sorts,
    visible,
    isOpen,
  });
  latest.current = {
    formData,
    linkDateFormats,
    pageKeys,
    expanded,
    entries,
    sorts,
    visible,
    isOpen,
  };
  const generation = useRef(0);
  const controllers = useRef(new Map<AbortController, number>());
  const singles = useRef(new Map<string, Single>());
  const owners = useRef(new Map<string, Owner>());
  const epochs = useRef(new Map<string, number>());
  const failed = useRef(new Set<string>());
  const refreshRun = useRef<RefreshRun>();
  const rounds = useRef(new Map<number, Set<Owner>>());
  const epochOf = useCallback(
    (key: string) => epochs.current.get(key) ?? 0,
    [],
  );
  const stale = useCallback(
    (key: string) => {
      const owner = owners.current.get(key);
      return Boolean(owner && owner.epochs.get(key) !== epochOf(key));
    },
    [epochOf],
  );
  const syncPending = useCallback(
    () => setPending(new Set(owners.current.keys())),
    [],
  );
  const record = useCallback(
    (key: string, action: AreaAction, origin: AreaOrigin = 'user') =>
      setRecords(previous => new Map(previous).set(key, { action, origin })),
    [],
  );

  const recordAll = useCallback(
    (keys: string[], action: AreaAction, origin: (key: string) => AreaOrigin) =>
      setRecords(previous => {
        const next = new Map(previous);
        keys.forEach(key => next.set(key, { action, origin: origin(key) }));
        return next;
      }),
    [],
  );

  const abortAll = useCallback(() => {
    generation.current += 1;
    refreshRun.current = undefined;
    controllers.current.forEach((_level, controller) => controller.abort());
    controllers.current.clear();
    singles.current.clear();
    owners.current.clear();
    rounds.current.clear();
    setPending(new Set());
  }, []);

  /** Abort the requests of one level only; other levels keep loading. */
  const abortLevel = useCallback((level: number) => {
    rounds.current.delete(level);
    controllers.current.forEach((sentLevel, controller) => {
      if (sentLevel !== level) return;
      controller.abort();
      controllers.current.delete(controller);
    });
    [singles.current, owners.current].forEach(map =>
      [...map.keys()].forEach(key => {
        if (pathOf(key).length === level) map.delete(key);
      }),
    );
  }, []);

  /** Advance the active refresh after the final owner of its level leaves. */
  const advanceRefresh = useCallback(
    (run: RefreshRun | undefined, level: number) => {
      if (!run || refreshRun.current !== run || run.level !== level) return;
      if ([...owners.current.keys()].some(key => pathOf(key).length === level))
        return;
      run.level = level + 1;
      run.sent = false;
      setRefreshStep(step => step + 1);
    },
    [],
  );

  const send = useCallback(
    (
      paths: string[][],
      level: number,
      force: boolean,
      options: { single?: 'open' | 'retry'; refresh?: boolean } = {},
    ) => {
      const previousRounds = !options.single && rounds.current.get(level);
      if (previousRounds) {
        const resend = new Map(paths.map(path => [areaKey(path), path]));
        const closed: string[] = [];
        previousRounds.forEach(round => {
          round.replaced = true;
          rounds.current.delete(level);
          round.checks.forEach((single, key) => {
            single.controller.abort();
            controllers.current.delete(single.controller);
            if (singles.current.get(key) === single)
              singles.current.delete(key);
            if (owners.current.get(key) !== round) return;
            owners.current.delete(key);
            if (latest.current.isOpen(key)) resend.set(key, pathOf(key));
            else {
              failed.current.add(key);
              closed.push(key);
            }
          });
        });
        setEntries(previous => {
          const next = new Map(previous);
          closed.forEach(key => next.delete(key));
          return next;
        });
        paths = [...resend.values()];
        if (refreshRun.current?.level === level)
          options = { ...options, refresh: true };
      }
      const allLevels = latest.current.formData.levels ?? [];
      const childLevel = allLevels[level];
      if (!childLevel?.parent_column) {
        setEntries(previous => {
          const next = new Map(previous);
          paths.forEach(path =>
            next.set(areaKey(path), { ...loadingEntry, status: 'error' }),
          );
          return next;
        });
        advanceRefresh(refreshRun.current, level);
        return;
      }
      const sendPart = (paths: string[][]) => {
        const keys = paths.map(areaKey);
        const request: TreeTableChildRequest = {
          level,
          paths,
          linkDateFormats: latest.current.linkDateFormats,
          sort: latest.current.sorts.get(level),
        };
        const sentGeneration = generation.current;
        const controller = new AbortController();
        controllers.current.set(controller, level);
        const sentSingle: Single | undefined = options.single && {
          controller,
          kind: options.single,
        };
        if (sentSingle) singles.current.set(keys[0], sentSingle);
        const owner: Owner = {
          force,
          epochs: new Map(keys.map(key => [key, epochOf(key)])),
          checks: new Map(),
        };
        keys.forEach(key => owners.current.set(key, owner));
        const run = refreshRun.current;
        const current = () =>
          !controller.signal.aborted &&
          sentGeneration === generation.current &&
          (!sentSingle || singles.current.get(keys[0]) === sentSingle);
        const takeOwned = () => {
          const owned = keys.filter(key => owners.current.get(key) === owner);
          owned.forEach(key => owners.current.delete(key));
          return owned;
        };
        const nextLevel = () => advanceRefresh(run, level);
        setEntries(previous => {
          const next = new Map(previous);
          keys.forEach(key => {
            const old = previous.get(key);
            if (old?.status === 'loaded' && old.rows.length) {
              const kept = { ...old };
              delete kept.more;
              next.set(key, kept);
            } else next.set(key, loadingEntry);
          });
          return next;
        });
        syncPending();
        fetchChildren(
          {
            formData: latest.current.formData,
            buildQuery: formData =>
              buildChildrenQuery(formData as TreeTableFormData, {
                ownState: { treeTableChildren: request },
              }),
            force,
            signal: controller.signal,
          },
          allLevels,
          request,
          fetchChildData,
        )
          .then(async result => {
            if (!current()) return;
            const owned = takeOwned();
            owned.forEach(key => failed.current.delete(key));
            const base = buildQueryObject(
              normalizeTreeFormData(latest.current.formData),
            );
            const inRange = childRangeApplies(
              {
                ...base,
                filters: parentDateFilters(
                  base,
                  allLevels[0],
                  latest.current.formData.extra_form_data?.time_range,
                ),
              },
              allLevels,
              level,
            );
            const loaded = toEntries(result, request, allLevels, inRange);
            const ownedSet = new Set(owned);
            [...loaded.keys()].forEach(key => {
              if (!ownedSet.has(key)) loaded.delete(key);
            });
            const ambiguous = new Set(
              loaded.ambiguous.map(areaKey).filter(key => ownedSet.has(key)),
            );
            const verify = (latest.current.visible[level - 1] ?? [])
              .filter(
                path =>
                  ambiguous.has(areaKey(path)) &&
                  latest.current.isOpen(areaKey(path)),
              )
              .slice(0, 10);
            const verifying = new Set(verify.map(areaKey));
            if (verify.length) {
              const active = rounds.current.get(level) ?? new Set<Owner>();
              active.add(owner);
              rounds.current.set(level, active);
            }
            ambiguous.forEach(key => {
              if (verifying.has(key)) owners.current.set(key, owner);
              else if (latest.current.isOpen(key))
                loaded.set(key, { ...loadingEntry, status: 'error', inRange });
              else failed.current.add(key);
            });
            unstable_batchedUpdates(() => {
              setEntries(previous => {
                const next = new Map([...previous, ...loaded]);
                ambiguous.forEach(key => {
                  if (failed.current.has(key)) next.delete(key);
                });
                return pruneLeft(next, loaded, childLevel.id_column);
              });
              syncPending();
            });
            await Promise.all(
              verify.map(async path => {
                const key = areaKey(path);
                const checkController = new AbortController();
                const single: Single = {
                  controller: checkController,
                  kind: 'retry',
                };
                owner.checks.set(key, single);
                singles.current.set(key, single);
                controllers.current.set(checkController, level);
                const valid = () =>
                  current() &&
                  !checkController.signal.aborted &&
                  singles.current.get(key) === single &&
                  owners.current.get(key) === owner;
                const apply = (entry: ChildrenEntry) => {
                  if (!valid()) return;
                  owners.current.delete(key);
                  unstable_batchedUpdates(() => {
                    setEntries(previous =>
                      pruneLeft(
                        new Map(previous).set(key, entry),
                        new Map([[key, entry]]),
                        childLevel.id_column,
                      ),
                    );
                    syncPending();
                  });
                };
                try {
                  const answer = await fetchChildData({
                    formData: latest.current.formData,
                    buildQuery: formData =>
                      buildChildrenQuery(formData as TreeTableFormData, {
                        ownState: {
                          treeTableChildren: { ...request, paths: [path] },
                        },
                      }),
                    force,
                    signal: checkController.signal,
                  });
                  const entry = toEntries(
                    answer,
                    { ...request, paths: [path] },
                    allLevels,
                    inRange,
                  ).get(key);
                  if (entry) apply(entry);
                } catch (error) {
                  if ((error as Error)?.name !== 'AbortError')
                    apply({ ...loadingEntry, status: 'error', inRange });
                } finally {
                  owner.checks.delete(key);
                  controllers.current.delete(checkController);
                  if (singles.current.get(key) === single)
                    singles.current.delete(key);
                }
              }),
            );
            if (owner.replaced) return;
            const active = rounds.current.get(level);
            active?.delete(owner);
            if (!active?.size) rounds.current.delete(level);
            if (current())
              unstable_batchedUpdates(() => {
                syncPending();
                nextLevel();
                setRefreshStep(step => step + 1);
              });
          })
          .catch(error => {
            if ((error as Error)?.name === 'AbortError') {
              if (sentSingle) {
                takeOwned();
                syncPending();
                nextLevel();
              }
              return;
            }
            if (!current()) return;
            const open = latest.current.isOpen;
            const owned = takeOwned();
            unstable_batchedUpdates(() => {
              setEntries(previous => {
                const next = new Map(previous);
                owned.forEach(key => {
                  if (open(key))
                    next.set(key, { ...loadingEntry, status: 'error' });
                  else {
                    next.delete(key);
                    failed.current.add(key);
                  }
                });
                return next;
              });
              syncPending();
              nextLevel();
            });
          })
          .finally(() => {
            controllers.current.delete(controller);
            if (sentSingle && singles.current.get(keys[0]) === sentSingle)
              singles.current.delete(keys[0]);
          });
      };
      for (let offset = 0; offset < paths.length; offset += 1000) {
        sendPart(paths.slice(offset, offset + 1000));
      }
    },
    [advanceRefresh, epochOf, fetchChildData, syncPending],
  );

  /**
   * The visible rows of the level above `level` that can still take a batch:
   * a key, no entry, not in flight, not marked failed.
   */
  const batchPaths = useCallback((level: number) => {
    const { visible: shown, entries: known } = latest.current;
    return (shown[level - 1] ?? []).filter(path => {
      const key = areaKey(path);
      return (
        !known.has(key) && !owners.current.has(key) && !failed.current.has(key)
      );
    });
  }, []);

  const open = useCallback(
    (path: string[]) => {
      const level = path.length;
      if (!latest.current.formData.levels?.[level]) return;
      const key = areaKey(path);
      const reopened = stale(key);
      if (latest.current.entries.has(key) && !reopened) return;
      if (reopened || failed.current.has(key)) {
        send(
          [path],
          level,
          reopened && Boolean(owners.current.get(key)?.force),
          { single: 'open' },
        );
        return;
      }
      const paths = batchPaths(level);
      if (!paths.some(item => areaKey(item) === key)) paths.push(path);
      if (paths.length === 1) send(paths, level, false, { single: 'open' });
      else send(paths, level, false);
    },
    [send, stale, batchPaths],
  );

  const close = useCallback(
    (path: string[]) => {
      const key = areaKey(path);
      epochs.current.set(key, epochOf(key) + 1);
      const run = refreshRun.current;
      const refreshLevel = run?.level;
      if (refreshLevel !== undefined) {
        setEntries(previous => {
          const next = new Map(previous);
          previous.forEach((_entry, candidate) => {
            const candidatePath = pathOf(candidate);
            if (
              candidatePath.length > refreshLevel &&
              path.every((part, index) => candidatePath[index] === part)
            )
              next.delete(candidate);
          });
          return next.size === previous.size ? previous : next;
        });
      }
      const single = singles.current.get(key);
      if (!single) return;
      singles.current.delete(key);
      single.controller.abort();
      controllers.current.delete(single.controller);
      if (single.kind !== 'more') owners.current.delete(key);
      syncPending();
      setEntries(previous => {
        const entry = previous.get(key);
        const next = new Map(previous);
        if (single.kind === 'more' && entry) {
          const kept = { ...entry };
          delete kept.more;
          next.set(key, kept);
        } else if (single.kind !== 'more') next.delete(key);
        return next;
      });
      advanceRefresh(run, path.length);
    },
    [advanceRefresh, epochOf, syncPending],
  );

  const retry = useCallback(
    (path: string[]) => {
      record(areaKey(path), 'retry');
      send([path], path.length, false, { single: 'retry' });
    },
    [record, send],
  );

  const loadMore = useCallback(
    (path: string[]) => {
      const key = areaKey(path);
      const level = latest.current.formData.levels?.[path.length];
      const entry = latest.current.entries.get(key);
      if (
        !level?.parent_column ||
        entry?.status !== 'loaded' ||
        entry.rows.length >= entry.total ||
        entry.more === 'loading' ||
        singles.current.has(key) ||
        owners.current.has(key)
      )
        return;
      record(key, entry.more === 'error' ? 'retry' : 'load-more');
      const request: TreeTableChildRequest = {
        level: path.length,
        paths: [path],
        linkDateFormats: latest.current.linkDateFormats,
        sort: latest.current.sorts.get(path.length),
        offset: entry.rows.length,
      };
      const sentGeneration = generation.current;
      const controller = new AbortController();
      controllers.current.set(controller, path.length);
      const sentSingle: Single = { controller, kind: 'more' };
      singles.current.set(key, sentSingle);
      const current = () =>
        sentGeneration === generation.current &&
        singles.current.get(key) === sentSingle;
      const update = (change: (old: ChildrenEntry) => ChildrenEntry) =>
        setEntries(previous => {
          const old = previous.get(key);
          if (!old || old.status !== 'loaded' || old.rows !== entry.rows)
            return previous;
          return new Map(previous).set(key, change(old));
        });
      update(old => ({ ...old, more: 'loading' }));
      fetchChildData({
        formData: latest.current.formData,
        buildQuery: formData =>
          buildChildrenQuery(formData as TreeTableFormData, {
            ownState: { treeTableChildren: request },
          }),
        force: false,
        signal: controller.signal,
      })
        .then(result => {
          if (current())
            update(old =>
              appendMore(
                old,
                result,
                level.children_shown ?? DEFAULT_CHILDREN_SHOWN,
              ),
            );
        })
        .catch(error => {
          if ((error as Error)?.name !== 'AbortError' && current())
            update(old => ({ ...old, more: 'error' }));
        })
        .finally(() => {
          controllers.current.delete(controller);
          if (singles.current.get(key) === sentSingle)
            singles.current.delete(key);
        });
    },
    [fetchChildData, record],
  );

  const setSort = useCallback(
    (level: number, next: ChildSort, fromPath: string[]) => {
      const nextSorts = new Map(latest.current.sorts);
      if (next) nextSorts.set(level, next);
      else nextSorts.delete(level);
      latest.current.sorts = nextSorts;
      setSortsState(nextSorts);
      abortLevel(level);
      const keys = [...latest.current.entries.keys()].filter(
        key => pathOf(key).length === level,
      );
      const fromKey = areaKey(fromPath);
      recordAll(
        keys.filter(key => latest.current.isOpen(key)),
        'child-sort',
        key => (key === fromKey ? 'user' : 'refresh'),
      );
      if (!keys.length) return;
      const run = refreshRun.current;
      if (run?.level === level) {
        run.sent = true;
        send(keys.map(pathOf), level, run.force, { refresh: true });
      } else send(keys.map(pathOf), level, false);
    },
    [abortLevel, recordAll, send],
  );

  const reset = useCallback(() => {
    abortAll();
    epochs.current.clear();
    failed.current.clear();
    setEntries(new Map());
    setRecords(new Map());
  }, [abortAll]);

  const firstData = useRef(true);
  const shownFilters = useRef<ReturnType<typeof parentFilters>>();
  useEffect(() => {
    const filters = parentFilters(latest.current.formData);
    const sameQuery = isEqual(filters, shownFilters.current);
    shownFilters.current = filters;
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    abortAll();
    failed.current.clear();
    const keys = latest.current.pageKeys;
    const onPage = new Set(keys);
    setRecords(
      previous =>
        new Map([...previous].filter(([key]) => onPage.has(pathOf(key)[0]))),
    );
    const openKeys = keys.filter(key => latest.current.expanded.has(key));
    const allLevels = latest.current.formData.levels ?? [];
    if (openKeys.length && allLevels[1]) {
      const { isOpen: wasOpen, entries: known } = latest.current;
      const openAreas = [
        ...openKeys.map(key => areaKey([key])),
        ...[...known.keys()].filter(
          key => pathOf(key).length > 1 && wasOpen(key),
        ),
      ];
      recordAll(
        openAreas.filter(key => onPage.has(pathOf(key)[0])),
        'refresh',
        () => 'refresh',
      );
      setEntries(
        previous =>
          new Map(
            [...previous].filter(([key]) => {
              const path = pathOf(key);
              return onPage.has(path[0]) && (path.length === 1 || wasOpen(key));
            }),
          ),
      );
      refreshRun.current = { force: sameQuery, level: 1, sent: true };
      send(
        keys.map(key => [key]),
        1,
        sameQuery,
        { refresh: true },
      );
    } else {
      setEntries(new Map());
    }
  }, [data, abortAll, recordAll, send]);

  useEffect(() => abortAll, [abortAll]);

  useEffect(() => {
    const run = refreshRun.current;
    for (let level = 2; level < levels.length; level += 1) {
      if ([...rounds.current.keys()].some(loading => loading < level)) return;
      if (run && level >= run.level) {
        if (level === run.level && !run.sent) {
          const paths = visible[level - 1].filter(path =>
            isOpen(areaKey(path)),
          );
          if (!paths.length) refreshRun.current = undefined;
          else {
            run.sent = true;
            send(paths, level, run.force, { refresh: true });
          }
        }
        return;
      }
      const waiting = visible[level - 1].filter(path => {
        const key = areaKey(path);
        return isOpen(key) && !entries.has(key) && !owners.current.has(key);
      });
      const retried = waiting.filter(path => failed.current.has(areaKey(path)));
      retried.forEach(path => send([path], level, false, { single: 'open' }));
      if (waiting.length > retried.length)
        send(batchPaths(level), level, false);
    }
    if (run && run.level >= levels.length) refreshRun.current = undefined;
  }, [levels, visible, isOpen, entries, refreshStep, send, batchPaths]);

  const hasChildren = useCallback(
    (path: string[]) => Boolean(levels[path.length]),
    [levels],
  );
  const areas = useMemo(() => {
    const map = new Map<string, AreaState>();
    const recordOf = (key: string, path: string[]): AreaRecord =>
      records.get(key) ??
      (path.length > 1 && expandLevel >= path.length
        ? EXPAND_ALL
        : USER_EXPAND);
    [...[...expanded].map(key => areaKey([key])), ...childExpanded].forEach(
      key => {
        const path = pathOf(key);
        const entry = entries.get(key);
        let state: AreaState['state'] = 'detail';
        if (hasChildren(path))
          state = !entry || pending.has(key) ? 'loading' : entry.status;
        map.set(key, {
          path,
          level: path.length,
          ...recordOf(key, path),
          state,
          ...(entry?.more && { more: entry.more }),
          ...(entry?.status === 'loaded' && {
            loaded: entry.rows.length,
            total: entry.total,
          }),
        });
      },
    );
    return map;
  }, [
    expanded,
    childExpanded,
    entries,
    pending,
    records,
    hasChildren,
    expandLevel,
  ]);

  const expandAll = useCallback(
    (level: number, keys: string[], childKeys: string[]) => {
      const { expanded: openKeys } = latest.current;
      const areaKeys = keys.map(key => areaKey([key]));
      if (level === 0) {
        [...singles.current.keys()].forEach(key => close(pathOf(key)));
        openKeys.forEach(key => close([key]));
        recordAll(
          [...openKeys].map(key => areaKey([key])),
          'collapse',
          () => 'expand-all',
        );
        return;
      }
      setRecords(previous => {
        const next = new Map(
          level > 1
            ? [...previous].filter(([key]) => pathOf(key).length < 2)
            : previous,
        );
        [...areaKeys, ...childKeys].forEach(key => next.set(key, EXPAND_ALL));
        return next;
      });
      if (!latest.current.formData.levels?.[1]) return;
      const missing = keys.filter(
        key =>
          !latest.current.entries.has(areaKey([key])) || stale(areaKey([key])),
      );
      if (missing.length)
        send(
          missing.map(key => [key]),
          1,
          missing.some(key => owners.current.get(areaKey([key]))?.force),
        );
    },
    [close, recordAll, send, stale],
  );

  return useMemo(
    () => ({
      entries,
      childExpanded,
      open,
      close,
      retry,
      loadMore,
      sorts,
      setSort,
      expandAll,
      record,
      reset,
      areas,
    }),
    [
      entries,
      childExpanded,
      open,
      close,
      retry,
      loadMore,
      sorts,
      setSort,
      expandAll,
      record,
      reset,
      areas,
    ],
  );
}
