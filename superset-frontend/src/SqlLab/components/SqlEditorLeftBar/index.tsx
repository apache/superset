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
import { views } from 'src/core';
import ExtensionPlaceholder from 'src/extensions/ExtensionPlaceholder';
import ViewListExtension from 'src/components/ViewListExtension';
import { EMPTY_STATE_QE_ID } from 'src/SqlLab/hooks/useQueryEditor';
import { useLeftBarLayout } from 'src/SqlLab/hooks/useLeftBarLayout';
import DatabaseSelectorPopover from '../DatabaseSelectorPopover';

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

/**
 * A rail view's content is whatever's registered at that container's own
 * id (Explorer and Settings included — see builtins.tsx), via the same
 * generic mechanism any other location uses. Falls back to
 * ExtensionPlaceholder when nothing is registered there yet, matching
 * `resolveView`'s own fallback for an unknown id.
 */
const renderPanel = (viewId: string) =>
  views.getViews(viewId)?.length ? (
    <ViewListExtension viewId={viewId} />
  ) : (
    <ExtensionPlaceholder id={viewId} />
  );

/**
 * Renders whichever panel is currently active in the left sidebar. The
 * icon rail itself lives outside the Splitter (see AppLayout) so it stays
 * visible regardless of this panel's collapsed/hidden state; this
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
    <LeftBarContent data-test="sql-editor-left-bar">
      {visitedIds.map(viewId => (
        <PanelSlot
          key={viewId}
          active={viewId === activeViewId}
          data-test={`left-bar-panel-slot-${viewId}`}
        >
          {renderPanel(viewId)}
        </PanelSlot>
      ))}
    </LeftBarContent>
  );
};

export default SqlEditorLeftBar;
