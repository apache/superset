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
import { css, styled } from '@superset-ui/core';
import AntdTabs, { TabsProps as AntdTabsProps } from 'antd/lib/tabs';
import Icons from 'src/components/Icons';

export interface TabsProps extends AntdTabsProps {
  fullWidth?: boolean;
  allowOverflow?: boolean;
}

const StyledTabs = ({
  animated = false,
  fullWidth = true,
  allowOverflow = true,
  ...props
}: TabsProps) => (
  <AntdTabs
    animated={animated}
    {...props}
    css={theme => css`
      overflow: ${allowOverflow ? 'visible' : 'hidden'};

      .ant-tabs-content-holder {
        overflow: ${allowOverflow ? 'visible' : 'auto'};
      }
      .ant-tabs-tab {
        flex: 1 1 auto;
        &.ant-tabs-tab-active .ant-tabs-tab-btn {
          color: inherit;
        }
        &:hover {
          .anchor-link-container {
            cursor: pointer;
            .fa.fa-link {
              visibility: visible;
            }
          }
        }
        .short-link-trigger.btn {
          padding: 0 ${theme.gridUnit}px;
          & > .fa.fa-link {
            top: 0;
          }
        }
      }
      ${fullWidth &&
      css`
        .ant-tabs-nav-list {
          width: 100%;
        }
      `};

      .ant-tabs-tab-btn {
        display: flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        font-size: ${theme.typography.sizes.s}px;
        text-align: center;
        text-transform: uppercase;
        user-select: none;
        .required {
          margin-left: ${theme.gridUnit / 2}px;
          color: ${theme.colors.error.base};
        }
      }
      .ant-tabs-ink-bar {
        background: ${theme.colors.secondary.base};
      }
    `}
  />
);

const StyledTabPane = styled(AntdTabs.TabPane)``;

const Tabs = Object.assign(StyledTabs, {
  TabPane: StyledTabPane,
});

const StyledEditableTabs = styled(StyledTabs)`
  ${({ theme, fullWidth }) => `
    .ant-tabs-content-holder {
      background: ${theme.colors.grayscale.light5};
    }

    & > .ant-tabs-nav {
      margin-bottom: 0;
    }

    .ant-tabs-tab-remove {
      padding-top: 0;
      padding-bottom: 0;
      height: ${theme.gridUnit * 6}px;
    }

    ${
      fullWidth
        ? css`
            .ant-tabs-nav-list {
              width: 100%;
            }
          `
        : ''
    }
  `}
`;

const StyledCancelXIcon = styled(Icons.CancelX)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;
export const EditableTabs = Object.assign(StyledEditableTabs, {
  TabPane: StyledTabPane,
});

EditableTabs.defaultProps = {
  type: 'editable-card',
  fullWidth: false,
  animated: { inkBar: true, tabPane: false },
};

EditableTabs.TabPane.defaultProps = {
  closeIcon: <StyledCancelXIcon role="button" tabIndex={0} />,
};

export const StyledLineEditableTabs = styled(EditableTabs)`
  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    margin: 0 ${({ theme }) => theme.gridUnit * 4}px;
    padding: ${({ theme }) => `${theme.gridUnit * 3}px ${theme.gridUnit}px`};
    background: transparent;
    border: none;
  }

  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar {
    visibility: visible;
  }

  .ant-tabs-tab-btn {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
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
