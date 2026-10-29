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
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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

export type QueryWarningConfirmation = {
  action: 'confirm';
  reason: 'warning' | 'unavailable';
  message: string;
  details?: { label: string; value: string }[];
};
type CheckResult = QueryWarningConfirmation | { action: 'proceed' };
type Attempt = { query: Query; key: string; result?: QueryWarningConfirmation };

/** Reject incomplete responses rather than treating them as permission to execute. */
export function parseWarningResult(result: unknown): CheckResult {
  const invalid = () => new Error(t('The query warning response was invalid.'));
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw invalid();
  const value = result as Record<string, unknown>;
  if (value.action === 'proceed') return { action: 'proceed' };
  if (
    value.action !== 'confirm' ||
    (value.reason !== 'warning' && value.reason !== 'unavailable') ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    (value.details !== undefined &&
      (!Array.isArray(value.details) ||
        !value.details.every(
          (detail: unknown) =>
            detail !== null &&
            typeof detail === 'object' &&
            !Array.isArray(detail) &&
            'label' in detail &&
            'value' in detail &&
            typeof detail.label === 'string' &&
            typeof detail.value === 'string',
        )))
  )
    throw invalid();
  return value as QueryWarningConfirmation;
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
  const [pending, setPending] = useState<Attempt>();

  const readInputs = useCallback(() => {
    const state = store.getState();
    const props = inputs.current;
    const editor = getUpToDateQuery(state, props.queryEditor);
    const database: DatabaseObject | undefined =
      state.sqlLab.databases[editor.dbId || ''];
    const enabled = isFeatureEnabled(FeatureFlag.SqlLabQueryCostWarnings);
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
      rule: database?.query_cost_warning,
      warningState: database?.query_warning_state,
      enabled,
    });
    return {
      editor,
      database,
      enabled,
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
  useLayoutEffect(() => {
    inputs.current = { queryEditor, defaultQueryLimit };
  }, [queryEditor, defaultQueryLimit]);
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
      const { editor, database, enabled, key, active } = readInputs();
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
        !enabled ||
        database.query_warning_state === 'disabled' ||
        database.query_warning_state === 'unsupported'
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
        });
        if (!isCurrent(attempt)) return;
        const result = parseWarningResult(json.result);
        if (result.action === 'confirm') {
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
              t('Query warning check failed.'),
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
