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
import React from 'react';
import { css, styled } from '@superset-ui/core';
import { Tabs as AntdTabs } from 'src/common/components';
import Icon from 'src/components/Icon';

interface TabsProps {
  fullWidth?: boolean;
  allowOverflow?: boolean;
}

const notForwardedProps = ['fullWidth', 'allowOverflow'];

const StyledTabs = styled(AntdTabs, {
  shouldForwardProp: prop => !notForwardedProps.includes(prop),
})<TabsProps>`
  overflow: ${({ allowOverflow }) => (allowOverflow ? 'visible' : 'hidden')};

  .ant-tabs-content-holder {
    overflow: ${({ allowOverflow }) => (allowOverflow ? 'visible' : 'auto')};
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
      padding: 0 ${({ theme }) => theme.gridUnit}px;

      & > .fa.fa-link {
        top: 0;
      }
    }
  }

  ${({ fullWidth }) =>
    fullWidth &&
    css`
      .ant-tabs-nav-list {
        width: 100%;
      }

      .ant-tabs-tab {
        width: 0;
      }
    `};

  .ant-tabs-tab-btn {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    text-align: center;
    text-transform: uppercase;
    user-select: none;

    .required {
      margin-left: ${({ theme }) => theme.gridUnit / 2}px;
      color: ${({ theme }) => theme.colors.error.base};
    }
  }

  .ant-tabs-ink-bar {
    background: ${({ theme }) => theme.colors.secondary.base};
  }
`;

const StyledTabPane = styled(AntdTabs.TabPane)``;

const Tabs = Object.assign(StyledTabs, {
  TabPane: StyledTabPane,
});

Tabs.defaultProps = {
  fullWidth: true,
};

const StyledEditableTabs = styled(StyledTabs)`
  .ant-tabs-content-holder {
    background: white;
  }

  & > .ant-tabs-nav {
    margin-bottom: 0;
  }

  .ant-tabs-tab-remove {
    padding-top: 0;
    padding-bottom: 0;
    height: ${({ theme }) => theme.gridUnit * 6}px;
  }

  ${({ fullWidth }) =>
    fullWidth &&
    css`
      .ant-tabs-nav-list {
        width: 100%;
      }
    `}
`;

export const EditableTabs = Object.assign(StyledEditableTabs, {
  TabPane: StyledTabPane,
});

EditableTabs.defaultProps = {
  type: 'editable-card',
  fullWidth: false,
};

EditableTabs.TabPane.defaultProps = {
  closeIcon: (
    <Icon role="button" tabIndex={0} cursor="pointer" name="cancel-x" />
  ),
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
