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

/**
 * @fileoverview Registers SQL Lab's two built-in left sidebar view
 * containers — Explorer and Settings — through the same generic
 * `views.registerViewContainer` / `views.registerView` API an extension
 * would use, rather than hardcoding their icon and content into the rail
 * itself. Registered once as a module-level side effect, mirroring how
 * extensions register their own contributions at import time.
 */
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import { Disposable, resetViews, views } from 'src/core';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { EMPTY_STATE_QE_ID } from 'src/SqlLab/hooks/useQueryEditor';
import {
  LEFT_SIDEBAR_LOCATION,
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
} from 'src/SqlLab/hooks/useManageableLeftBarEntries';
import TabExplorer from '../TabExplorer';
import LeftBarViewSettingsPanel from './LeftBarViewSettingsPanel';

export { TAB_EXPLORER_ID, TAB_SETTINGS_ID };

const ExplorerIcon = () => <Icons.TableOutlined />;
const SettingsIcon = () => <Icons.SettingOutlined />;

/**
 * Explorer's registered view. Views are rendered with no props, so — unlike
 * the query-editor-scoped `TabExplorer` it wraps — this reads the active
 * query editor id itself, the same selector AppLayout uses to derive it.
 */
const ExplorerContainerView = () => {
  const queryEditorId = useSelector<SqlLabRootState, string>(
    ({ sqlLab: { tabHistory } }) => tabHistory.slice(-1)[0],
  );
  const activeQEId = queryEditorId || EMPTY_STATE_QE_ID;
  // Keyed by the query editor tab so Explorer shows that tab's own
  // database/catalog/schema selection, resetting when it changes.
  return <TabExplorer key={activeQEId} queryEditorId={activeQEId} />;
};

/**
 * Registers Explorer and Settings. Exported (rather than only run as a
 * side effect below) so tests can re-run it after resetting the view
 * registry.
 */
export const registerBuiltinLeftBarContainers = (): Disposable =>
  Disposable.from(
    views.registerViewContainer(LEFT_SIDEBAR_LOCATION, {
      id: TAB_EXPLORER_ID,
      name: t('Explorer'),
      icon: ExplorerIcon,
      // Sorts before any container relying on the default order (100), so
      // Explorer leads the strip by default — matching its role as the
      // rail's default active view — without the id-based tiebreak
      // depending on how it happens to compare against an extension's id.
      order: -1,
    }),
    views.registerView(
      { id: TAB_EXPLORER_ID, name: t('Explorer') },
      TAB_EXPLORER_ID,
      ExplorerContainerView,
    ),
    views.registerViewContainer(LEFT_SIDEBAR_LOCATION, {
      id: TAB_SETTINGS_ID,
      name: t('Settings'),
      icon: SettingsIcon,
      // Sorts after any container relying on the default order (100), so
      // Settings lands last on its own merits — on top of `useLeftBarTabs`
      // always pinning it last regardless of order.
      order: Number.MAX_SAFE_INTEGER,
    }),
    views.registerView(
      { id: TAB_SETTINGS_ID, name: t('Settings') },
      TAB_SETTINGS_ID,
      LeftBarViewSettingsPanel,
    ),
  );

registerBuiltinLeftBarContainers();

/**
 * Test-only. Resets the entire view/view-container registry — every
 * extension along with these two built-ins — then immediately
 * re-registers Explorer and Settings, so each test starts from the same
 * rail-with-only-the-built-ins baseline.
 */
export const resetLeftBarViews = (): void => {
  resetViews();
  registerBuiltinLeftBarContainers();
};
