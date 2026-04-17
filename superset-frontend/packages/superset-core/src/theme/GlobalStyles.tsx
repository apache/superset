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

// @fontsource/* v5.1+ doesn't play nice with eslint-import plugin v2.31+
/* eslint-disable import/extensions */
import '@fontsource/inter/200.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
/* eslint-enable import/extensions */

import { css, useTheme, Global } from '@emotion/react';

export const GlobalStyles = () => {
  const theme = useTheme();
  return (
    <Global
      key={`global-${theme.colorLink}`}
      styles={css`
        // SPA
        html,
        body,
        #app {
          height: 100%;
        }

        body {
          background-color: ${theme.colorBgBase};
          color: ${theme.colorText};
          -webkit-font-smoothing: antialiased;
          margin: 0;
          font-family: ${theme.fontFamily};
        }

        a {
          color: ${theme.colorLink};
        }

        /* WCAG 1.4.3: Minimum Contrast — route link colors through theme tokens
           so they adapt to light, dark, and custom themes. The token defaults
           (colorLink / colorLinkHover) are tuned to meet the 4.5:1 contrast
           threshold on the paired colorBgBase; hardcoded hex values previously
           used here were light-mode-only and failed WCAG in dark themes.
           Excludes links that are intentionally styled as buttons. */
        a:not([class*="ant-btn"]):not([role="button"]) {
          color: ${theme.colorLink};
        }
        a:not([class*="ant-btn"]):not([role="button"]):hover {
          color: ${theme.colorLinkHover};
        }

        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        strong,
        th {
          font-weight: ${theme.fontWeightStrong};
        }

        .echarts-tooltip[style*='visibility: hidden'] {
          display: none !important;
        }

        .no-wrap {
          white-space: nowrap;
        }

        .column-config-popover {
          & .ant-input-number {
            width: 100%;
          }
          && .btn-group svg {
            line-height: 0;
            top: 0;
          }
          & .btn-group > .btn {
            padding: 5px 10px 6px;
          }
        }

        // Overriding bootstrap styles
        #app {
          flex: 1 1 auto;
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        [role='button'] {
          cursor: pointer;
        }

        // Override geostyler CSS that hides AntD ColorPicker alpha input
        // See: https://github.com/apache/superset/issues/34721
        .ant-color-picker .ant-color-picker-alpha-input {
          display: block;
        }

        .ant-color-picker .ant-color-picker-slider-alpha {
          display: flex;
          margin-top: ${theme.marginXS}px;
        }
      `}
    />
  );
};
