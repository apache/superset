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
import { useState } from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { LeftBarViewPanelHost } from 'src/core';
import { EMPTY_STATE_QE_ID } from 'src/SqlLab/hooks/useQueryEditor';
import { useLeftBarLayout } from 'src/SqlLab/hooks/useLeftBarLayout';
import {
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
} from 'src/SqlLab/hooks/useLeftBarTabs';
import DatabaseSelectorPopover from '../DatabaseSelectorPopover';
import TabExplorer from '../TabExplorer';
import LeftBarViewSettingsPanel from './LeftBarViewSettingsPanel';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
  /**
   * Compact mode for SqlEditorTopBar's `extra` slot while the sidebar is
   * hidden. Renders only the database selector.
   */
  collapsed?: boolean;
}

const LeftBarContent = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding-inline-start: ${theme.sizeUnit * 2}px;
  `}
`;

const PanelSlot = styled.div<{ active: boolean }>`
  display: ${({ active }) => (active ? 'flex' : 'none')};
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const renderPanel = (viewId: string, activeQEId: string) => {
  if (viewId === TAB_EXPLORER_ID) {
    // Keyed by the query editor tab (not the rail view) — Explorer shows a
    // given tab's own database/catalog/schema selection, so it resets when
    // *that* changes, independently of the rail-view persistence below.
    return <TabExplorer key={activeQEId} queryEditorId={activeQEId} />;
  }
  if (viewId === TAB_SETTINGS_ID) {
    return <LeftBarViewSettingsPanel />;
  }
  return <LeftBarViewPanelHost viewId={viewId} />;
};

/**
 * Renders whichever panel is currently active in the left sidebar — the
 * built-in Explorer, an extension's panel, or the built-in Settings panel.
 * The icon rail itself lives outside the Splitter (see AppLayout) so it
 * stays visible regardless of this panel's collapsed/hidden state; this
 * component only ever renders content.
 */
const SqlEditorLeftBar = ({
  queryEditorId,
  collapsed = false,
}: SqlEditorLeftBarProps) => {
  const activeQEId = queryEditorId || EMPTY_STATE_QE_ID;
  const { activeViewId } = useLeftBarLayout();
  // Every rail view the user has switched to stays mounted (hidden via CSS
  // rather than unmounted) from then on, so flipping between rail icons
  // doesn't reset a panel's own state — adjusted during the render phase
  // itself, so the newly active view is already in this list by the time
  // it renders below, not a render later via an effect.
  const [visitedIds, setVisitedIds] = useState<string[]>([activeViewId]);
  if (!visitedIds.includes(activeViewId)) {
    setVisitedIds(prev => [...prev, activeViewId]);
  }

  if (collapsed) {
    return <DatabaseSelectorPopover queryEditorId={activeQEId} compact />;
  }

  return (
    <LeftBarContent data-test="left-bar-content">
      {visitedIds.map(viewId => (
        <PanelSlot
          key={viewId}
          active={viewId === activeViewId}
          data-test={`left-bar-panel-slot-${viewId}`}
        >
          {renderPanel(viewId, activeQEId)}
        </PanelSlot>
      ))}
    </LeftBarContent>
  );
};

export default SqlEditorLeftBar;
