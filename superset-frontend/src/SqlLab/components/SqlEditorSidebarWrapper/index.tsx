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
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { css, styled } from '@apache-superset/core';
import { useComponentDidUpdate } from '@superset-ui/core';
import { Button, Grid, Icons } from '@superset-ui/core/components';
import { Splitter } from 'src/components/Splitter';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { toggleLeftBar } from 'src/SqlLab/actions/sqlLab';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import { noop } from 'lodash';
import SqlEditorLeftBar from '../SqlEditorLeftBar';

type Props = {
  queryEditorId: string;
};

const StyledContainer = styled.div`
  height: 100%;
  background-color: ${({ theme }) => theme.colorBgBase};

  & .ant-splitter-bar-dragger::after {
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

const SqlEditorSidebarWrapper: React.FC<Props> = ({
  queryEditorId,
  children,
}) => {
  const { md } = Grid.useBreakpoint();
  const [width, setWidth] = useStoredSidebarWidth(
    'sqllab:leftbar',
    SQL_EDITOR_LEFTBAR_WIDTH,
  );
  const autoHide = useEffectEvent(() => {
    if (width > 0) {
      setWidth(0);
    }
  });
  useComponentDidUpdate(() => {
    if (!md) {
      autoHide();
    }
  }, [md]);
  const onSidebarChange = (sizes: number[]) => {
    const [updatedWidth] = sizes;
    if (updatedWidth === 0) {
      setWidth(0);
    } else {
      // Due to a bug in the splitter, the width must be changed
      // in order to properly restore the previous size
      setWidth(updatedWidth + 0.01);
    }
  };

  return (
    <StyledContainer>
      <Splitter lazy onResizeEnd={onSidebarChange} onResize={noop}>
        <Splitter.Panel
          collapsible={{ showCollapsibleIcon: false }}
          size={width}
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
                inset-inline-end: -4px;
                padding: 0 4px;
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
          {width === 0 && (
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
      </Splitter>
    </StyledContainer>
  );
};

export default SqlEditorSidebarWrapper;
