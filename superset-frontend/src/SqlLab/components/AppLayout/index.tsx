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
import { useSelector } from 'react-redux';
import { noop } from 'lodash';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { css, styled } from '@apache-superset/core';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Button, Grid, Icons } from '@superset-ui/core/components';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { useExtensionsContext } from 'src/extensions/ExtensionsContext';
import { Splitter } from 'src/components/Splitter';
import useEffectEvent from 'src/hooks/useEffectEvent';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import {
  SQL_EDITOR_LEFTBAR_WIDTH,
  SQL_EDITOR_RIGHTBAR_WIDTH,
} from 'src/SqlLab/constants';

import SqlEditorLeftBar from '../SqlEditorLeftBar';

export const RIGHT_SIDEBAR_VIEW_ID = 'sqllab.rightSidebar';

const StyledContainer = styled.div`
  height: 100%;

  & .ant-splitter-panel:not(.sqllab-body) {
    background-color: ${({ theme }) => theme.colorBgBase};
  }

  &
    .ant-splitter-panel:first-child
    + .ant-splitter-bar
    .ant-splitter-bar-dragger::after {
    background-color: transparent !important;
  }

  & .sqllab-body {
    flex-grow: 1 !important;
    padding-top: ${({ theme }) => theme.sizeUnit * 2.5}px;
  }
`;

const StyledSidebar = styled.div`
  position: relative;
  padding: ${({ theme }) => theme.sizeUnit * 2.5}px;
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
  const autoHide = useEffectEvent(() => {
    if (leftWidth > 0) {
      setLeftWidth(0);
    }
  });
  useComponentDidUpdate(() => {
    if (!md) {
      autoHide();
    }
  }, [md]);
  const onSidebarChange = (sizes: number[]) => {
    const [updatedWidth, _, possibleRightWidth] = sizes;
    if (updatedWidth === 0) {
      setLeftWidth(0);
    } else {
      // Due to a bug in the splitter, the width must be changed
      // in order to properly restore the previous size
      setLeftWidth(updatedWidth + 0.01);
    }

    if (typeof possibleRightWidth === 'number') {
      if (possibleRightWidth === 0) {
        setRightWidth(0);
      } else {
        // Due to a bug in the splitter, the width must be changed
        // in order to properly restore the previous size
        setRightWidth(possibleRightWidth + 0.01);
      }
    }
  };
  const contributions =
    ExtensionsManager.getInstance().getViewContributions(
      RIGHT_SIDEBAR_VIEW_ID,
    ) || [];
  const { getView } = useExtensionsContext();

  return (
    <StyledContainer>
      <Splitter lazy onResizeEnd={onSidebarChange} onResize={noop}>
        <Splitter.Panel
          collapsible={{ showCollapsibleIcon: false }}
          size={leftWidth}
          min={SQL_EDITOR_LEFTBAR_WIDTH}
        >
          <StyledSidebar>
            <SqlEditorLeftBar
              key={queryEditorId}
              queryEditorId={queryEditorId}
            />
            <Button
              css={css`
                position: absolute;
                top: 10px;
                inset-inline-end: 0px;
                border-top-right-radius: 0px;
                border-bottom-right-radius: 0px;
                padding: 0 2px 0 4px;
              `}
              onClick={() => onSidebarChange([0])}
            >
              <Icons.VerticalAlignBottomOutlined
                iconSize="l"
                css={css`
                  rotate: 90deg;
                `}
              />
            </Button>
          </StyledSidebar>
        </Splitter.Panel>
        <Splitter.Panel className="sqllab-body">
          {children}
          {leftWidth === 0 && (
            <Button
              css={css`
                position: absolute;
                top: 10px;
                inset-inline-start: -4px;
                padding: 0 4px;
              `}
              onClick={() => onSidebarChange([SQL_EDITOR_LEFTBAR_WIDTH])}
            >
              <Icons.VerticalAlignBottomOutlined
                iconSize="l"
                css={css`
                  rotate: -90deg;
                `}
              />
            </Button>
          )}
        </Splitter.Panel>
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
              {contributions.map(contribution => getView(contribution.id))}
            </ContentWrapper>
          </Splitter.Panel>
        )}
      </Splitter>
    </StyledContainer>
  );
};

export default AppLayout;
