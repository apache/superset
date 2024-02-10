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
import { css, SupersetTheme } from '@superset-ui/core';

export const headerStyles = (theme: SupersetTheme) => css`
  body {
    h1 {
      font-weight: ${theme.typography.weights.bold};
      line-height: 1.4;
      font-size: ${theme.typography.sizes.xxl}px;
      letter-spacing: -0.2px;
      margin-top: ${theme.gridUnit * 3}px;
      margin-bottom: ${theme.gridUnit * 3}px;
    }

    h2 {
      font-weight: ${theme.typography.weights.bold};
      line-height: 1.4;
      font-size: ${theme.typography.sizes.xl}px;
      margin-top: ${theme.gridUnit * 3}px;
      margin-bottom: ${theme.gridUnit * 2}px;
    }

    h3,
    h4,
    h5,
    h6 {
      font-weight: ${theme.typography.weights.bold};
      line-height: 1.4;
      font-size: ${theme.typography.sizes.l}px;
      letter-spacing: 0.2px;
      margin-top: ${theme.gridUnit * 2}px;
      margin-bottom: ${theme.gridUnit}px;
    }
  }
`;

export const filterCardPopoverStyle = (theme: SupersetTheme) => css`
  .filter-card-popover {
    width: 240px;
    padding: 0;
    border-radius: 4px;

    &.ant-popover-placement-bottom {
      padding-top: ${theme.gridUnit}px;
    }

    &.ant-popover-placement-left {
      padding-right: ${theme.gridUnit * 3}px;
    }

    .ant-popover-inner {
      box-shadow: 0 0 8px rgb(0 0 0 / 10%);
    }

    .ant-popover-inner-content {
      padding: ${theme.gridUnit * 4}px;
    }

    .ant-popover-arrow {
      display: none;
    }
  }

  .filter-card-tooltip {
    &.ant-tooltip-placement-bottom {
      padding-top: 0;
      & .ant-tooltip-arrow {
        top: -13px;
      }
    }
  }
`;

export const chartContextMenuStyles = (theme: SupersetTheme) => css`
  .ant-dropdown-menu.chart-context-menu {
    min-width: ${theme.gridUnit * 43}px;
  }
  .ant-dropdown-menu-submenu.chart-context-submenu {
    max-width: ${theme.gridUnit * 60}px;
    min-width: ${theme.gridUnit * 40}px;
  }
`;
