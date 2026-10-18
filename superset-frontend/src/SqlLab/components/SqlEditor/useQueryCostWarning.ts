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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import type { DatabaseObject } from 'src/features/databases/types';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import {
  CtasEnum,
  getSqlEditorQuery,
  getUpToDateQuery,
  Query,
  runQuery,
  setActiveSouthPaneTab,
} from 'src/SqlLab/actions/sqlLab';
import { useAppDispatch } from 'src/SqlLab/hooks/useAppDispatch';
import type { QueryEditor, SqlLabRootState } from 'src/SqlLab/types';

export type WarningEstimate = {
  status: 'exceeded' | 'unavailable' | 'within_threshold';
  metric: 'bytes_processed' | 'total_cost';
  label: string;
  unit: string;
  value: number | bigint | null;
  threshold: number;
  message?: string;
  accuracy?: string;
};
type CheckResult = WarningEstimate | { status: 'disabled' | 'unsupported' };
type Attempt = { query: Query; key: string; result?: WarningEstimate };

/** Reject incomplete responses rather than treating them as permission to execute. */
export function parseWarningResult(result: unknown): CheckResult {
  const invalid = () =>
    new Error(t('The query cost warning response was invalid.'));
  if (!result || typeof result !== 'object') throw invalid();
  const value = result as Record<string, unknown>;
  if (value.status === 'disabled' || value.status === 'unsupported') {
    return { status: value.status };
  }
  if (
    !['exceeded', 'within_threshold', 'unavailable'].includes(
      String(value.status),
    ) ||
    !['bytes_processed', 'total_cost'].includes(String(value.metric)) ||
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    typeof value.unit !== 'string' ||
    !value.unit.trim() ||
    typeof value.threshold !== 'number' ||
    !Number.isFinite(value.threshold) ||
    value.threshold <= 0 ||
    (value.message !== undefined && typeof value.message !== 'string') ||
    (value.accuracy !== undefined && typeof value.accuracy !== 'string')
  )
    throw invalid();
  const usable =
    value.metric === 'bytes_processed'
      ? (typeof value.value === 'bigint' && value.value >= BigInt(0)) ||
        (typeof value.value === 'number' &&
          Number.isSafeInteger(value.value) &&
          value.value >= 0)
      : typeof value.value === 'number' &&
        Number.isFinite(value.value) &&
        value.value >= 0;
  if (
    (!usable && !(value.status === 'unavailable' && value.value === null)) ||
    (value.metric === 'bytes_processed' &&
      !Number.isSafeInteger(value.threshold)) ||
    (value.status === 'unavailable' &&
      (typeof value.message !== 'string' || !value.message.trim()))
  )
    throw invalid();
  return value as WarningEstimate;
}

/** Own one captured Run attempt; cancellation invalidates callbacks, not database jobs. */
export default function useQueryCostWarning(
  queryEditor: QueryEditor,
  defaultQueryLimit: number,
) {
  const store = useStore<SqlLabRootState>();
  const dispatch = useAppDispatch();
  const current = useRef<Attempt>();
  const mounted = useRef(false);
  const inputs = useRef({ queryEditor, defaultQueryLimit });
  inputs.current = { queryEditor, defaultQueryLimit };
  const [pending, setPending] = useState<Attempt>();

  const readInputs = useCallback(() => {
    const state = store.getState();
    const props = inputs.current;
    const editor = getUpToDateQuery(state, props.queryEditor);
    const database: DatabaseObject | undefined =
      state.sqlLab.databases[editor.dbId || ''];
    const flags = [
      isFeatureEnabled(FeatureFlag.SqlLabQueryCostWarnings),
      isFeatureEnabled(FeatureFlag.EstimateQueryCost),
    ];
    const key = JSON.stringify({
      id: editor.id,
      active: state.sqlLab.tabHistory.slice(-1)[0],
      sql: editor.sql,
      selectedText: editor.selectedText,
      dbId: editor.dbId,
      catalog: editor.catalog,
      schema: editor.schema,
      templateParams: editor.templateParams,
      limit: editor.queryLimit || props.defaultQueryLimit,
      async: database?.allow_run_async,
      tab: editor.name,
      tabViewId: editor.tabViewId,
      immutableId: editor.immutableId,
      backend: database?.backend,
      estimation: database?.allows_cost_estimate,
      rule: database?.query_cost_warning,
      metric: database?.engine_information?.query_cost_warning_metric,
      flags,
    });
    return {
      editor,
      database,
      flags,
      key,
      active: state.sqlLab.tabHistory.slice(-1)[0] === editor.id,
    };
  }, [store]);

  const cancel = useCallback(() => {
    current.current = undefined;
    setPending(undefined);
  }, []);
  const isCurrent = useCallback(
    (attempt: Attempt) =>
      mounted.current &&
      current.current === attempt &&
      readInputs().key === attempt.key,
    [readInputs],
  );
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = store.subscribe(() => {
      if (current.current && !isCurrent(current.current)) cancel();
    });
    return () => {
      mounted.current = false;
      current.current = undefined;
      unsubscribe();
    };
  }, [cancel, isCurrent, store]);
  useEffect(() => {
    if (current.current && !isCurrent(current.current)) cancel();
  });

  const execute = useCallback(
    (query: Query) => {
      dispatch(runQuery(query));
      dispatch(setActiveSouthPaneTab('Results'));
    },
    [dispatch],
  );
  const continueRun = useCallback(() => {
    const attempt = current.current;
    if (!attempt?.result || !isCurrent(attempt)) {
      cancel();
      return;
    }
    cancel();
    execute(attempt.query);
  }, [cancel, execute, isCurrent]);

  const start = useCallback(
    async (
      tempTable = '',
      ctas = false,
      ctasMethod: string = CtasEnum.Table,
      automatic = false,
      sql?: string,
    ) => {
      if (current.current) return;
      const { editor, database, flags, key, active } = readInputs();
      if (!database || (!active && !automatic)) return;
      const query = getSqlEditorQuery(
        { id: database.id, allow_run_async: Boolean(database.allow_run_async) },
        sql === undefined ? editor : { ...editor, selectedText: sql },
        inputs.current.defaultQueryLimit,
        tempTable,
        ctas,
        ctasMethod,
      );
      if (
        ctas ||
        automatic ||
        flags.some(flag => !flag) ||
        // The display rule masks invalid settings; only the server can disable it.
        database.allows_cost_estimate === false ||
        database.engine_information?.query_cost_warning_metric === null
      ) {
        execute(query);
        return;
      }
      const attempt: Attempt = { query, key };
      current.current = attempt;
      setPending(attempt);
      try {
        const { json } = await SupersetClient.post({
          endpoint: '/api/v1/sqllab/estimate/',
          jsonPayload: {
            check_warning: true,
            database_id: query.dbId,
            sql: query.sql,
            catalog: query.catalog,
            schema: query.schema,
            template_params: JSON.parse(query.templateParams || '{}'),
            query_limit: query.queryLimit,
          },
          parseMethod: 'json-bigint',
        });
        if (!isCurrent(attempt)) return;
        const result = parseWarningResult(json.result);
        if (result.status === 'exceeded' || result.status === 'unavailable') {
          const confirmation = { ...attempt, result };
          current.current = confirmation;
          setPending(confirmation);
        } else {
          cancel();
          execute(query);
        }
      } catch (error) {
        if (!isCurrent(attempt)) return;
        const clientError = await getClientErrorObject(error);
        if (!isCurrent(attempt)) return;
        cancel();
        dispatch(
          addDangerToast(
            clientError.error ||
              clientError.message ||
              clientError.statusText ||
              t('Query cost check failed.'),
          ),
        );
      }
    },
    [cancel, dispatch, execute, isCurrent, readInputs],
  );
  return {
    start,
    cancel,
    continueRun,
    checking: !!pending && !pending.result,
    confirmation: pending?.result,
  };
}
