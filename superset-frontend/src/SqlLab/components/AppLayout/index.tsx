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
import { styled } from '@apache-superset/core';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Grid } from '@superset-ui/core/components';
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
import { ViewContribution } from 'src/SqlLab/contributions';

const StyledContainer = styled.div`
  height: 100%;

  & .ant-splitter-panel:not(.sqllab-body):not(.queryPane) {
    background-color: ${({ theme }) => theme.colorBgBase};
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
    setLeftWidth(updatedWidth);

    if (typeof possibleRightWidth === 'number') {
      setRightWidth(possibleRightWidth);
    }
  };
  const contributions =
    ExtensionsManager.getInstance().getViewContributions(
      ViewContribution.RightSidebar,
    ) || [];
  const { getView } = useExtensionsContext();

  return (
    <StyledContainer>
      <Splitter lazy onResizeEnd={onSidebarChange} onResize={noop}>
        <Splitter.Panel
          collapsible={{
            start: true,
            end: true,
            showCollapsibleIcon: true,
          }}
          size={leftWidth}
          min={SQL_EDITOR_LEFTBAR_WIDTH}
        >
          <StyledSidebar>
            <SqlEditorLeftBar
              key={queryEditorId}
              queryEditorId={queryEditorId}
            />
          </StyledSidebar>
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
              {contributions.map(contribution => getView(contribution.id))}
            </ContentWrapper>
          </Splitter.Panel>
        )}
      </Splitter>
    </StyledContainer>
  );
};

export default AppLayout;
