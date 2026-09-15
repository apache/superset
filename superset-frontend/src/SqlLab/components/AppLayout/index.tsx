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
import { useDispatch, useSelector } from 'react-redux';
import { noop } from 'lodash-es';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { css, styled } from '@apache-superset/core/theme';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Grid } from '@superset-ui/core/components';
import { useViews } from 'src/core';
import { Splitter } from 'src/components/Splitter';
import useEffectEvent from 'src/hooks/useEffectEvent';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  SQL_EDITOR_LEFTBAR_WIDTH,
  SQL_EDITOR_RIGHTBAR_WIDTH,
} from 'src/SqlLab/constants';
import { ViewLocations } from 'src/SqlLab/contributions';
import ViewListExtension from 'src/components/ViewListExtension';
import { toggleLeftBar } from 'src/SqlLab/actions/sqlLab';
import {
  getLeftPanelLayout,
  useLeftBarLayout,
} from 'src/SqlLab/hooks/useLeftBarLayout';

import SqlEditorLeftBar from '../SqlEditorLeftBar';
import LeftBarRail from '../SqlEditorLeftBar/LeftBarRail';
import StatusBar from '../StatusBar';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;

  & .ant-splitter-panel:not(.sqllab-body):not(.queryPane) {
    background-color: ${({ theme }) => theme.colorBgBase};
  }

  & .sqllab-body {
    flex-grow: 1 !important;
    padding-top: ${({ theme }) => theme.sizeUnit * 2.5}px;
  }
`;

// The rail is a sibling of the Splitter, not a child inside it, so it stays
// mounted and visible regardless of the Splitter panel's own collapsed/
// hidden state or which view is active.
const StyledMainRow = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const StyledSidebar = styled.div<{ hasRail: boolean }>`
  ${({ theme, hasRail }) => css`
    position: relative;
    padding: ${theme.sizeUnit * 2.5}px 0;
    margin: 0 ${theme.sizeUnit * 2.5}px;
    /* The rail already sits flush against this edge, so its own gutter
       would just double up as a gap between the rail and the sidebar. */
    margin-inline-start: ${hasRail ? 0 : `${theme.sizeUnit * 2.5}px`};
    flex: 1;
    height: 100%;
    background-color: ${theme.colorBgBase};
  `}
`;

const ContentWrapper = styled.div`
  flex: 1;
  overflow: auto;
`;

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const queryEditorId = useSelector<SqlLabRootState, string>(
    ({ sqlLab: { tabHistory } }) => tabHistory.slice(-1)[0],
  );
  const { md } = Grid.useBreakpoint();
  const [leftWidth, setLeftWidth] = useStoredSidebarWidth(
    'sqllab:leftbar',
    SQL_EDITOR_LEFTBAR_WIDTH,
  );
  const [rightWidth, setRightWidth] = useStoredSidebarWidth(
    'sqllab:rightbar',
    SQL_EDITOR_RIGHTBAR_WIDTH,
  );
  const {
    mainTabs,
    settingsTab,
    hasRail,
    activeViewId,
    contentCollapsed,
    selectView,
    toggleContent,
    expandContent,
  } = useLeftBarLayout();
  const leftPanel = getLeftPanelLayout({
    leftWidth,
    contentCollapsed,
    hasRail,
  });

  const hideSidebar = useEffectEvent(() => {
    if (leftWidth > 0) {
      setLeftWidth(0);
    }
    // A hidden content panel has nothing to show, so a stale inner collapse
    // would otherwise resurface as a 400 -> 0 snap the next time it's shown.
    expandContent();
  });
  // Undoes hideSidebar's leftWidth: 0 — needed because the Splitter's own
  // drag/collapsible-icon can hide the panel independently of the rail, and
  // from that state contentCollapsed is already false, so toggleContent()
  // alone is a no-op (size stays 0 regardless).
  const openSidebar = () => {
    setLeftWidth(SQL_EDITOR_LEFTBAR_WIDTH);
    dispatch(toggleLeftBar(false));
  };
  useComponentDidUpdate(() => {
    if (!md) {
      hideSidebar();
    }
  }, [md]);
  const onSidebarChange = (sizes: number[]) => {
    const [updatedWidth, _, possibleRightWidth] = sizes;
    if (contentCollapsed) {
      // While rail-collapsed, this panel's rendered size is pinned to 0
      // regardless of the stored leftWidth, so an unrelated resize-end
      // (e.g. dragging the *right* sidebar) still reports 0 here too —
      // persisting that would clobber the stored expanded width. A nonzero
      // report can only mean the Splitter's own collapsible icon just
      // restored it, which we honor, clearing the rail's collapse flag too
      // so collapsedByRail doesn't immediately re-collapse it next render.
      if (updatedWidth > 0) {
        setLeftWidth(updatedWidth);
        dispatch(toggleLeftBar(false));
        expandContent();
      }
    } else {
      setLeftWidth(updatedWidth);
      dispatch(toggleLeftBar(updatedWidth === 0));
      if (updatedWidth === 0) {
        expandContent();
      }
    }

    if (typeof possibleRightWidth === 'number') {
      setRightWidth(possibleRightWidth);
    }
  };
  const viewItems = useViews(ViewLocations.sqllab.rightSidebar) || [];

  return (
    <StyledContainer>
      <StyledMainRow>
        {hasRail && (
          <LeftBarRail
            items={mainTabs}
            pinnedItems={settingsTab ? [settingsTab] : []}
            activeId={activeViewId}
            onSelect={id => {
              if (leftWidth === 0) {
                openSidebar();
                selectView(id);
                return;
              }
              if (id === activeViewId) {
                toggleContent();
              } else {
                selectView(id);
              }
            }}
          />
        )}
        <Splitter
          css={css`
            flex: 1;
          `}
          lazy
          onResizeEnd={onSidebarChange}
          onResize={noop}
        >
          <Splitter.Panel
            collapsible={{ start: true, end: true, showCollapsibleIcon: true }}
            size={leftPanel.size}
            min={leftPanel.min}
            resizable={leftPanel.resizable}
          >
            <StyledSidebar hasRail={hasRail}>
              <SqlEditorLeftBar queryEditorId={queryEditorId} />
            </StyledSidebar>
          </Splitter.Panel>
          <Splitter.Panel className="sqllab-body">{children}</Splitter.Panel>
          {viewItems.length > 0 && (
            <Splitter.Panel
              collapsible={{
                start: true,
                end: true,
                showCollapsibleIcon: true,
              }}
              size={rightWidth}
              min={SQL_EDITOR_RIGHTBAR_WIDTH}
            >
              <ContentWrapper>
                <ViewListExtension viewId={ViewLocations.sqllab.rightSidebar} />
              </ContentWrapper>
            </Splitter.Panel>
          )}
        </Splitter>
      </StyledMainRow>
      <StatusBar />
    </StyledContainer>
  );
};

export default AppLayout;
