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

import { Global } from '@emotion/react';
import { css } from '@apache-superset/core/theme';

// Class applied to the SQL Lab tab bar's overflow ("...") dropdown so its menu
// items truncate long tab names. The dropdown is portaled to the body, outside
// the tabs' emotion scope, so it is styled here via a global rule.
export const SQLLAB_TAB_OVERFLOW_POPUP_CLASS = 'sqllab-tab-overflow-popup';

export const SqlLabGlobalStyles = () => (
  <Global
    styles={theme => css`
      body {
        min-height: max(
          100vh,
          ${theme.sizeUnit * 125}px
        ); /* Set a min height so the gutter is always visible when resizing */
        overflow: hidden;
      }

      /* The tab label is a flex node (icon menu + title + status icon). antd's */
      /* overflow dropdown styles each menu item for a plain-text label, so the */
      /* nested flex defeats its ellipsis and very long names render blank. Cap */
      /* the item width and let the title truncate inside it. */
      .${SQLLAB_TAB_OVERFLOW_POPUP_CLASS} {
        .ant-tabs-dropdown-menu-item {
          max-width: ${theme.sizeUnit * 80}px;
        }
        .ant-tabs-dropdown-menu-item > span {
          min-width: 0;
          overflow: hidden;
        }
        [data-test='sql-editor-tab-header'] {
          min-width: 0;
          width: 100%;
        }
        [data-test='sql-editor-tab-title'] {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    `}
  />
);
