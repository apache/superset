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
// page's bundle; the store applies it globally.
const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
const HYDRATE_EXPLORE = 'HYDRATE_EXPLORE';

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
    } else if (
      action.type === SET_FIELD_VALUE &&
      typeof action.controlName === 'string'
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
