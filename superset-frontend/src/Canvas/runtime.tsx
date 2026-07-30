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
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CdlFilter,
  CdlQueryContext,
  Primitive,
  VariableDecl,
  VariableValues,
} from './types';
import { QueryResult, resolveVars } from './resolve';

/* -------------------------------------------------------------------------- */
/* Variable store — the reactive spine.                                       */
/*                                                                            */
/* In-app, `query`-scoped variables project onto the host dashboard dataMask  */
/* (governed re-queries, caching, RLS). The prototype keeps them in React     */
/* state; `dataMaskSink` is the seam where the real dataMask dispatch plugs in.*/
/* -------------------------------------------------------------------------- */

interface VariableStore {
  vars: VariableValues;
  decls: Record<string, VariableDecl>;
  setVariable: (name: string, value: Primitive) => void;
  reset: () => void;
}

const VariableContext = createContext<VariableStore | undefined>(undefined);

export interface VariableProviderProps {
  variables: Record<string, VariableDecl>;
  children: ReactNode;
  /** Seam: receives every write so query-scoped vars can be pushed to dataMask. */
  dataMaskSink?: (
    name: string,
    value: Primitive,
    scope: VariableDecl['scope'],
  ) => void;
}

export function VariableProvider({
  variables,
  children,
  dataMaskSink,
}: VariableProviderProps) {
  const initial = useMemo<VariableValues>(
    () =>
      Object.fromEntries(
        Object.entries(variables).map(([name, decl]) => [name, decl.default]),
      ),
    [variables],
  );
  const [vars, setVars] = useState<VariableValues>(initial);

  const setVariable = useCallback(
    (name: string, value: Primitive) => {
      setVars(prev => ({ ...prev, [name]: value }));
      dataMaskSink?.(name, value, variables[name]?.scope ?? 'ui');
    },
    [dataMaskSink, variables],
  );

  const reset = useCallback(() => setVars(initial), [initial]);

  const value = useMemo<VariableStore>(
    () => ({ vars, decls: variables, setVariable, reset }),
    [vars, variables, setVariable, reset],
  );

  return (
    <VariableContext.Provider value={value}>
      {children}
    </VariableContext.Provider>
  );
}

export function useVariables(): VariableStore {
  const ctx = useContext(VariableContext);
  if (!ctx) {
    throw new Error('useVariables must be used within a VariableProvider');
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Query runner — the data seam.                                              */
/*                                                                            */
/* The prototype injects a runner (mock or real). The real runner maps a      */
/* CdlQueryContext to a Superset query_context and POSTs /api/v1/chart/data,  */
/* inheriting RLS/caching. Bound Viz nodes re-fetch when a referenced         */
/* variable changes.                                                          */
/* -------------------------------------------------------------------------- */

export interface QueryRunner {
  run: (queryContext: CdlQueryContext) => Promise<QueryResult>;
}

const QueryRunnerContext = createContext<QueryRunner | undefined>(undefined);

export function QueryRunnerProvider({
  runner,
  children,
}: {
  runner: QueryRunner;
  children: ReactNode;
}) {
  return (
    <QueryRunnerContext.Provider value={runner}>
      {children}
    </QueryRunnerContext.Provider>
  );
}

export function useQueryRunner(): QueryRunner {
  const ctx = useContext(QueryRunnerContext);
  if (!ctx) {
    throw new Error('useQueryRunner must be used within a QueryRunnerProvider');
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Filter store — canvas-global filters (the native-filter analogue).         */
/*                                                                            */
/* A Filter node writes an entry here; every bound Viz on the same dataset    */
/* merges the active filters into its query — so the AI places one filter and */
/* it applies across charts without wiring each query by hand.                */
/* -------------------------------------------------------------------------- */

export interface ActiveFilter {
  /** When set, the filter only applies to queries on this dataset. */
  datasetId?: number;
  filter: CdlFilter;
}

interface FilterStore {
  filters: Record<string, ActiveFilter | null>;
  setFilter: (id: string, value: ActiveFilter | null) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterStore | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Record<string, ActiveFilter | null>>(
    {},
  );
  const setFilter = useCallback(
    (id: string, value: ActiveFilter | null) =>
      setFilters(prev => ({ ...prev, [id]: value })),
    [],
  );
  const clearFilters = useCallback(() => setFilters({}), []);
  const value = useMemo<FilterStore>(
    () => ({ filters, setFilter, clearFilters }),
    [filters, setFilter, clearFilters],
  );
  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters(): FilterStore {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return ctx;
}

/** The active filters applicable to a query on `datasetId`. */
export function useActiveFilters(datasetId: number): CdlFilter[] {
  const { filters } = useFilters();
  return useMemo(
    () =>
      Object.values(filters)
        .filter((f): f is ActiveFilter => f != null)
        .filter(f => f.datasetId === undefined || f.datasetId === datasetId)
        .map(f => f.filter),
    [filters, datasetId],
  );
}

/* -------------------------------------------------------------------------- */
/* UI state — active tabs and a refresh nonce.                                */
/*                                                                            */
/* Backs the `navigateTab` and `refresh` actions so the bounded action        */
/* vocabulary is fully functional rather than partly stubbed.                 */
/* -------------------------------------------------------------------------- */

interface UiState {
  activeTabs: Record<string, string>;
  setActiveTab: (tabsId: string, tab: string) => void;
  /** Modal nodes are hidden until an `openModal` action opens them. */
  openModals: Record<string, boolean>;
  setModalOpen: (modalId: string, open: boolean) => void;
  /** Bumped by the `refresh` action; participates in every query cache key. */
  refreshNonce: number;
  refresh: () => void;
}

const UiStateContext = createContext<UiState | undefined>(undefined);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [openModals, setOpenModals] = useState<Record<string, boolean>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const setActiveTab = useCallback(
    (tabsId: string, tab: string) =>
      setActiveTabs(prev => ({ ...prev, [tabsId]: tab })),
    [],
  );
  const setModalOpen = useCallback(
    (modalId: string, open: boolean) =>
      setOpenModals(prev => ({ ...prev, [modalId]: open })),
    [],
  );
  const refresh = useCallback(() => setRefreshNonce(n => n + 1), []);
  const value = useMemo<UiState>(
    () => ({
      activeTabs,
      setActiveTab,
      openModals,
      setModalOpen,
      refreshNonce,
      refresh,
    }),
    [activeTabs, setActiveTab, openModals, setModalOpen, refreshNonce, refresh],
  );
  return (
    <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>
  );
}

export function useUiState(): UiState {
  const ctx = useContext(UiStateContext);
  if (!ctx) {
    throw new Error('useUiState must be used within a UiStateProvider');
  }
  return ctx;
}

export interface BoundQueryState {
  loading: boolean;
  error?: string;
  result?: QueryResult;
}

/**
 * Resolve `$vars` in a query context against the live store, merge in active
 * canvas filters, fetch, and re-fetch whenever the resolved context changes.
 */
export function useBoundQuery(queryContext: CdlQueryContext): BoundQueryState {
  const runner = useQueryRunner();
  const { vars } = useVariables();
  const { refreshNonce } = useUiState();
  const activeFilters = useActiveFilters(queryContext.datasetId);
  const resolved = useMemo(() => {
    const base = resolveVars(queryContext, vars);
    return { ...base, filters: [...(base.filters ?? []), ...activeFilters] };
  }, [queryContext, vars, activeFilters]);
  const key = `${JSON.stringify(resolved)}|${refreshNonce}`;
  const [state, setState] = useState<BoundQueryState>({ loading: true });

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    runner
      .run(resolved)
      .then(result => {
        if (live) setState({ loading: false, result });
      })
      .catch((error: unknown) => {
        if (live) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      live = false;
    };
    // `key` captures the resolved context; runner is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
