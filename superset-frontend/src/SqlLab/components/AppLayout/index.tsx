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
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { noop } from 'lodash';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { css, styled, t } from '@apache-superset/core';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Flex, Grid, Icons, Layout, Menu } from '@superset-ui/core/components';
import type { MenuProps } from '@superset-ui/core/components';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { Splitter } from 'src/components/Splitter';
import useEffectEvent from 'src/hooks/useEffectEvent';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  SQL_EDITOR_LEFTBAR_WIDTH,
  SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH,
  SQL_EDITOR_RIGHTBAR_WIDTH,
} from 'src/SqlLab/constants';
import { ViewContribution } from 'src/SqlLab/contributions';
import ViewListExtension from 'src/components/ViewListExtension';

import SqlEditorLeftBar from '../SqlEditorLeftBar';
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

const StyledSidebarWrapper = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
`;

const StyledMenu = styled(Menu)`
  ${({ theme }) => css`
    height: 100%;
    background-color: ${theme.colorBgElevated};
  `}
`;

const StyledSidebarContent = styled(Flex)`
  flex: 1;
  height: 100%;
  padding: ${({ theme }) => theme.sizeUnit * 2.5}px;
  background-color: ${({ theme }) => theme.colorBgBase};
`;

const ContentWrapper = styled.div`
  flex: 1;
  overflow: auto;
`;

const AppLayout: React.FC = ({ children }) => {
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

  const toggleSidebar = useCallback(() => {
    if (leftWidth <= SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH) {
      setLeftWidth(SQL_EDITOR_LEFTBAR_WIDTH);
    } else {
      setLeftWidth(SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH);
    }
  }, [leftWidth, setLeftWidth]);

  const collapsedMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'database',
        icon: <Icons.DatabaseOutlined />,
        label: t('Explore table schema'),
        onClick: toggleSidebar,
      },
      // TODO: Add extension items for left sidebar here
    ],
    [toggleSidebar],
  );

  const autoHide = useEffectEvent(() => {
    if (leftWidth > SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH) {
      setLeftWidth(SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH);
    }
  });
  useComponentDidUpdate(() => {
    if (!md) {
      autoHide();
    }
  }, [md]);
  const onSidebarChange = (sizes: number[]) => {
    const [updatedWidth, _, possibleRightWidth] = sizes;
    setLeftWidth(updatedWidth + SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH);

    if (typeof possibleRightWidth === 'number') {
      setRightWidth(possibleRightWidth);
    }
  };
  const contributions =
    ExtensionsManager.getInstance().getViewContributions(
      ViewContribution.RightSidebar,
    ) || [];

  return (
    <StyledContainer>
      <StyledSidebarWrapper>
        <Layout.Sider
          collapsed
          collapsedWidth={SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH}
        >
          <StyledMenu
            mode="vertical"
            items={collapsedMenuItems}
            selectable={false}
          />
        </Layout.Sider>
        <Splitter
          css={css`
            flex: 1;
          `}
          lazy
          onResizeEnd={onSidebarChange}
          onResize={noop}
        >
          <Splitter.Panel
            collapsible={{
              start: true,
              end: true,
              showCollapsibleIcon: true,
            }}
            size={leftWidth - SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH}
            min={SQL_EDITOR_LEFTBAR_WIDTH - SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH}
          >
            <StyledSidebarContent vertical>
              <SqlEditorLeftBar
                key={queryEditorId}
                queryEditorId={queryEditorId}
              />
            </StyledSidebarContent>
          </Splitter.Panel>
          <Splitter.Panel className="sqllab-body">{children}</Splitter.Panel>
          {contributions.length > 0 && (
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
                <ViewListExtension viewId={ViewContribution.RightSidebar} />
              </ContentWrapper>
            </Splitter.Panel>
          )}
        </Splitter>
      </StyledSidebarWrapper>
      <StatusBar />
    </StyledContainer>
  );
};

export default AppLayout;
