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
      font-weight: ${theme.fontWeightStrong};
      line-height: 1.4;
      font-size: ${theme.fontSizeXXL}px;
      letter-spacing: -0.2px;
      margin-top: ${theme.sizeUnit * 3}px;
      margin-bottom: ${theme.sizeUnit * 3}px;
    }

    h2 {
      font-weight: ${theme.fontWeightStrong};
      line-height: 1.4;
      font-size: ${theme.fontSizeXL}px;
      margin-top: ${theme.sizeUnit * 3}px;
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    h3,
    h4,
    h5,
    h6 {
      font-weight: ${theme.fontWeightStrong};
      line-height: 1.4;
      font-size: ${theme.fontSizeLG}px;
      letter-spacing: 0.2px;
      margin-top: ${theme.sizeUnit * 2}px;
      margin-bottom: ${theme.sizeUnit}px;
    }
  }
`;

// adds enough margin and padding so that the focus outline styles will fit
export const chartHeaderStyles = (theme: SupersetTheme) => css`
  .header-title a {
    margin: ${theme.sizeUnit / 2}px;
    padding: ${theme.sizeUnit / 2}px;
  }
  .header-controls {
    &,
    &:hover {
      margin-top: ${theme.sizeUnit}px;
    }
  }
`;

export const filterCardPopoverStyle = (theme: SupersetTheme) => css`
  .filter-card-tooltip {
    &.antd5-tooltip-placement-bottom {
      padding-top: 0;
      & .antd5-tooltip-arrow {
        top: -13px;
      }
    }
  }
`;

export const chartContextMenuStyles = (theme: SupersetTheme) => css`
  .antd5-dropdown-menu.chart-context-menu {
    min-width: ${theme.sizeUnit * 43}px;
  }
  .antd5-dropdown-menu-submenu.chart-context-submenu {
    max-width: ${theme.sizeUnit * 60}px;
    min-width: ${theme.sizeUnit * 40}px;
  }
`;

export const focusStyle = (theme: SupersetTheme) => css`
  a,
  .antd5-tabs-tabpane,
  .antd5-tabs-tab-btn,
  .superset-button,
  .superset-button.antd5-dropdown-trigger,
  .header-controls span {
    &:focus-visible {
      box-shadow: 0 0 0 2px ${theme.colorPrimaryText};
      border-radius: ${theme.sizeUnit / 2}px;
      outline: none;
      text-decoration: none;
    }
    &:not(
        .superset-button,
        .antd5-menu-item,
        a,
        .fave-unfave-icon,
        .antd5-tabs-tabpane,
        .header-controls span
      ) {
      &:focus-visible {
        padding: ${theme.sizeUnit / 2}px;
      }
    }
  }
`;
