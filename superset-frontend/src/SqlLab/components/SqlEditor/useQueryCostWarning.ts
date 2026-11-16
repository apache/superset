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
  buildSqlEditorQuery,
  getQueryExecutionPayload,
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
  const mounted = useRef(false);

  type Attempt = {
    query: Query;
    result?: QueryWarningConfirmation;
  };
  const activeAttemptRef = useRef<Attempt>();
  const [pendingAttempt, setPendingAttempt] = useState<Attempt>();

  const discard = useCallback((query: Query) => {
    SupersetClient.delete({
      endpoint: `/api/v1/sqllab/warning/${query.id}`,
    }).catch(() => undefined); // Unexecuted records follow normal query-history retention.
  }, []);
  const cancel = useCallback(() => {
    if (activeAttemptRef.current) discard(activeAttemptRef.current.query);
    activeAttemptRef.current = undefined;
    setPendingAttempt(undefined);
  }, [discard]);
  const isCurrent = useCallback(
    (attempt: Attempt) =>
      mounted.current && activeAttemptRef.current === attempt,
    [],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  const execute = useCallback(
    (query: Query) => {
      // Saving or renaming a tab changes its bookkeeping, not the checked SQL.
      const state = store.getState();
      const origin = state.sqlLab.queryEditors.find(
        editor =>
          (query.sqlEditorImmutableId &&
            editor.immutableId === query.sqlEditorImmutableId) ||
          editor.id === query.sqlEditorId ||
          editor.tabViewId === query.sqlEditorId,
      );
      if (!origin) {
        discard(query);
        return;
      }
      const editor = getUpToDateQuery(state, origin);
      dispatch(
        runQuery({
          ...query,
          sqlEditorId: editor.tabViewId ?? editor.id,
          tab: editor.name,
        }),
      );
      dispatch(setActiveSouthPaneTab('Results'));
    },
    [discard, dispatch, store],
  );
  const continueRun = useCallback(() => {
    const attempt = activeAttemptRef.current;
    if (!attempt?.result || !isCurrent(attempt)) {
      cancel();
      return;
    }
    activeAttemptRef.current = undefined;
    setPendingAttempt(undefined);
    execute(attempt.query);
  }, [cancel, execute, isCurrent]);

  const start = useCallback(
    async (
      tempTable = '',
      ctas = false,
      ctasMethod: string = CtasEnum.Table,
      isAutomaticRun = false,
      sql?: string,
    ) => {
      if (activeAttemptRef.current) return;
      const state = store.getState();
      const editor = getUpToDateQuery(state, queryEditor);
      const database: DatabaseObject | undefined =
        state.sqlLab.databases[editor.dbId || ''];
      const active = state.sqlLab.tabHistory.slice(-1)[0] === editor.id;
      if (!database || (!active && !isAutomaticRun)) return;
      const query = buildSqlEditorQuery(
        { id: database.id, allow_run_async: Boolean(database.allow_run_async) },
        sql === undefined ? editor : { ...editor, selectedText: sql },
        defaultQueryLimit,
        tempTable,
        ctas,
        ctasMethod,
      );
      if (
        ctas ||
        isAutomaticRun ||
        !isFeatureEnabled(FeatureFlag.SqlLabQueryCostWarnings) ||
        database.query_warning_state === 'disabled' ||
        database.query_warning_state === 'unsupported'
      ) {
        execute(query);
        return;
      }
      const attempt: Attempt = { query };
      activeAttemptRef.current = attempt;
      setPendingAttempt(attempt);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/sqllab/warning/${window.location.search || ''}`,
          jsonPayload: {
            execution: getQueryExecutionPayload(query),
            database_id: query.dbId,
            sql: query.sql,
            catalog: query.catalog,
            schema: query.schema,
            template_params: JSON.parse(query.templateParams || '{}'),
            query_limit: query.queryLimit,
          },
        });
        if (!isCurrent(attempt)) {
          discard(query);
          return;
        }
        const result = parseWarningResult(json.result);
        if (
          json.prepared_query_id !== undefined ||
          result.action === 'confirm'
        ) {
          if (
            typeof json.prepared_query_id !== 'string' ||
            !json.prepared_query_id
          ) {
            throw new Error(t('The query warning response was invalid.'));
          }
          query.preparedQueryId = json.prepared_query_id;
        }
        if (result.action === 'confirm') {
          const confirmation = { ...attempt, result };
          activeAttemptRef.current = confirmation;
          setPendingAttempt(confirmation);
        } else {
          activeAttemptRef.current = undefined;
          setPendingAttempt(undefined);
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
    [
      cancel,
      defaultQueryLimit,
      discard,
      dispatch,
      execute,
      isCurrent,
      queryEditor,
      store,
    ],
  );
  return {
    start,
    cancel,
    continueRun,
    checking: !!pendingAttempt && !pendingAttempt.result,
    confirmation: pendingAttempt?.result,
  };
}
