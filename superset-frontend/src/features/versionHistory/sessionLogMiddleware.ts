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
import type { Middleware } from 'redux';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { appendVersionSessionLog, clearVersionSessionLog } from './reducer';

// Action types are inlined (rather than imported from the explore
// module) so this middleware does not pull explore code into every
// page's bundle; the store applies it globally. Exported so the test
// suite can assert they match the real explore constants — a rename
// there would otherwise silently kill the session log.
export const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
export const UPDATE_CHART_TITLE = 'UPDATE_CHART_TITLE';
export const UPDATE_FORM_DATA_BY_DATASOURCE = 'UPDATE_FORM_DATA_BY_DATASOURCE';
export const HYDRATE_EXPLORE = 'HYDRATE_EXPLORE';

// The control whose label names a datasource change in the log. Both the
// swap and the Edit Dataset routes report under it, so the two entries
// collapse into one when a swap emits both.
const DATASOURCE_CONTROL_NAME = 'datasource';

interface SessionLogState {
  user?: { firstName?: string; lastName?: string };
  explore?: {
    controls?: Record<string, { label?: unknown } | undefined>;
  };
}

function controlLabel(state: SessionLogState, controlName: string): string {
  const label = state.explore?.controls?.[controlName]?.label;
  return typeof label === 'string' && label
    ? label
    : controlName.replace(/_/g, ' ');
}

function userName(state: SessionLogState): string | null {
  const name = [state.user?.firstName, state.user?.lastName]
    .filter(Boolean)
    .join(' ');
  return name || null;
}

/**
 * Records unsaved explore control changes in the version history
 * session log ("Current version" section) and resets the log whenever
 * the explore page (re)hydrates — initial load, save, or restore.
 */
export const versionSessionLogMiddleware: Middleware =
  store => next => action => {
    const result = next(action);
    if (!isFeatureEnabled(FeatureFlag.VersionHistory)) {
      return result;
    }
    if (action.type === HYDRATE_EXPLORE) {
      store.dispatch(clearVersionSessionLog());
    } else if (action.type === UPDATE_CHART_TITLE) {
      // Renaming the chart is an unsaved change like any control edit, but it
      // travels through its own action — without this branch the restore
      // gate's dirty signal missed it and a restore silently discarded the
      // rename.
      const state = store.getState() as SessionLogState;
      store.dispatch(
        appendVersionSessionLog({
          label: t('Renamed chart'),
          controlName: 'slice_name',
          ts: Date.now(),
          user: userName(state),
        }),
      );
    } else if (action.type === UPDATE_FORM_DATA_BY_DATASOURCE) {
      // Swapping the dataset and editing it in place both reconcile the
      // chart's form data against the new columns, but only the swap emits
      // a control change of its own (ChangeDatasourceModal's `onChange`).
      // Editing a dataset dispatches nothing the branches below record, so
      // without this the restore gate saw an empty log while the form had
      // changed — a restore then discarded the reconciled values silently.
      const state = store.getState() as SessionLogState;
      store.dispatch(
        appendVersionSessionLog({
          label: t(
            "Changed '%s'",
            controlLabel(state, DATASOURCE_CONTROL_NAME),
          ),
          controlName: DATASOURCE_CONTROL_NAME,
          ts: Date.now(),
          user: userName(state),
        }),
      );
    } else if (
      action.type === SET_FIELD_VALUE &&
      typeof action.controlName === 'string' &&
      // Effects rewrite controls with no user gesture (transferred-control
      // cleanup after load, derived values set alongside another control);
      // logging those would tell the user they have unsaved edits they never
      // made. Only user-initiated changes belong in the session log.
      !action.programmatic
    ) {
      const state = store.getState() as SessionLogState;
      store.dispatch(
        appendVersionSessionLog({
          label: t("Changed '%s'", controlLabel(state, action.controlName)),
          controlName: action.controlName,
          ts: Date.now(),
          user: userName(state),
        }),
      );
    }
    return result;
  };
