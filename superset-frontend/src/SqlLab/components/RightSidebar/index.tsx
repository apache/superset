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
import { Resizable } from 're-resizable';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { useExtensionsContext } from 'src/extensions/ExtensionsContext';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';

export const RIGHT_SIDEBAR_VIEW_ID = 'sqllab.rightSidebar';

const getDefaultWidth = () => Math.round(window.innerWidth * 0.25);
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

const RightSidebarContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border-left: 1px solid ${theme.colorBorderSecondary};
    overflow: hidden;
  `}
`;

const ContentWrapper = styled.div`
  flex: 1;
  overflow: auto;
`;

const RightSidebar = () => {
  const theme = useTheme();
  const [width, setWidth] = useStoredSidebarWidth(
    'sqllab.rightSidebar',
    getDefaultWidth(),
  );
  const contributions =
    ExtensionsManager.getInstance().getViewContributions(
      RIGHT_SIDEBAR_VIEW_ID,
    ) || [];
  const { getView } = useExtensionsContext();

  if (contributions.length === 0) {
    return null;
  }

  return (
    <Resizable
      enable={{ left: true }}
      size={{ width, height: '100%' }}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      onResizeStop={(e, direction, ref, d) => setWidth(width + d.width)}
      handleStyles={{
        left: {
          width: '4px',
          left: 0,
        },
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colorBgContainer,
      }}
      handleComponent={{
        left: (
          <div
            css={css`
              width: 4px;
              height: 100%;
              cursor: col-resize;
              transition: background-color 0.2s;
              &:hover {
                background-color: ${theme.colorPrimary};
              }
            `}
          />
        ),
      }}
    >
      <RightSidebarContainer data-test="sql-lab-right-sidebar">
        <ContentWrapper>
          {contributions.map(contribution => getView(contribution.id))}
        </ContentWrapper>
      </RightSidebarContainer>
    </Resizable>
  );
};

export default RightSidebar;
