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
import { css, styled, useTheme } from '@superset-ui/core';

// eslint-disable-next-line no-restricted-imports
import { Tabs as AntdTabs, TabsProps as AntdTabsProps } from 'antd';
import { Icons } from '@superset-ui/core/components/Icons';

export interface TabsProps extends AntdTabsProps {
  allowOverflow?: boolean;
}

const StyledTabs = ({
  animated = false,
  allowOverflow = true,
  ...props
}: TabsProps) => {
  const theme = useTheme();
  return (
    <AntdTabs
      animated={animated}
      {...props}
      tabBarStyle={{ paddingLeft: theme.sizeUnit * 4 }}
      css={theme => css`
        overflow: ${allowOverflow ? 'visible' : 'hidden'};

        .ant-tabs-content-holder {
          overflow: ${allowOverflow ? 'visible' : 'auto'};
        }
        .ant-tabs-tab {
          flex: 1 1 auto;

          .short-link-trigger.btn {
            padding: 0 ${theme.sizeUnit}px;
            & > .fa.fa-link {
              top: 0;
            }
          }
        }
        .ant-tabs-tab-btn {
          display: flex;
          flex: 1 1 auto;
          align-items: center;
          justify-content: center;
          font-size: ${theme.fontSizeSM}px;
          text-align: center;
          user-select: none;
          .required {
            margin-left: ${theme.sizeUnit / 2}px;
            color: ${theme.colorError};
          }
          &:focus-visible {
            box-shadow: none;
          }
        }
      `}
    />
  );
};

const StyledTabPane = styled(AntdTabs.TabPane)``;

const Tabs = Object.assign(StyledTabs, {
  TabPane: StyledTabPane,
});

const StyledEditableTabs = styled(StyledTabs)`
  ${({ theme }) => `
    .ant-tabs-content-holder {
      background: ${theme.colors.grayscale.light5};
    }

    & > .ant-tabs-nav {
      margin-bottom: 0;
    }

    .ant-tabs-tab-remove {
      padding-top: 0;
      padding-bottom: 0;
      height: ${theme.sizeUnit * 6}px;
    }
  `}
`;

const StyledCloseOutlined = styled(Icons.CloseOutlined)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;
export const EditableTabs = Object.assign(StyledEditableTabs, {
  TabPane: StyledTabPane,
});

EditableTabs.defaultProps = {
  type: 'editable-card',
  animated: { inkBar: true, tabPane: false },
};

EditableTabs.TabPane.defaultProps = {
  closeIcon: <StyledCloseOutlined iconSize="s" role="button" tabIndex={0} />,
};

export const StyledLineEditableTabs = styled(EditableTabs)`
  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    margin: 0 ${({ theme }) => theme.sizeUnit * 4}px;
    padding: ${({ theme }) => `${theme.sizeUnit * 3}px ${theme.sizeUnit}px`};
    background: transparent;
    border: none;
  }

  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar {
    visibility: visible;
  }

  .ant-tabs-tab-btn {
    font-size: ${({ theme }) => theme.fontSize}px;
  }

  .ant-tabs-tab-remove {
    margin-left: 0;
    padding-right: 0;
  }

  .ant-tabs-nav-add {
    min-width: unset !important;
    background: transparent !important;
    border: none !important;
  }
`;

export const LineEditableTabs = Object.assign(StyledLineEditableTabs, {
  TabPane: StyledTabPane,
});

export default Tabs;
