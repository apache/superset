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

        /* WCAG 1.4.4: Text Resize — ensure html root uses percentage-based font-size
           so the base respects user browser font-size preferences. Combined with the
           theme token system (which centralizes all font sizes), this allows text to
           scale up to 200% via browser zoom without loss of content. */
        html {
          font-size: 100%;
        }

        body {
          background-color: ${theme.colorBgBase};
          color: ${theme.colorText};
          -webkit-font-smoothing: antialiased;
          margin: 0;
          font-family: ${theme.fontFamily};
        }

        /* Link color is set via WCAG 1.4.3 override below (a { color: #0d7090 }) */

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

        /* WCAG 1.4.11: Non-text contrast — form field borders need 3:1 against background.
           Ant Design default colorBorder (#d9d9d9) is only ~1.34:1 on white.
           Using colorTextTertiary (~#8c8c8c, ~3.54:1 on white) for all input borders. */
        .ant-input,
        .ant-input-affix-wrapper,
        .ant-select:not(.ant-select-customize-input) .ant-select-selector,
        .ant-picker,
        .ant-input-number,
        .ant-input-number-group-wrapper .ant-input-number {
          border-color: ${theme.colorTextTertiary};
        }

        /* Ensure disabled inputs retain a visible (though lighter) border */
        .ant-input[disabled],
        .ant-select-disabled .ant-select-selector,
        .ant-picker-disabled,
        .ant-input-number-disabled {
          border-color: ${theme.colorTextQuaternary};
        }

        /* WCAG 1.4.11: Checkbox/Radio/Switch borders need 3:1 against background.
           Ant Design default uses colorBorder (~1.34:1 on white). Override to
           colorTextTertiary (~3.54:1) for unchecked state borders. */
        .ant-checkbox .ant-checkbox-inner {
          border-color: ${theme.colorTextTertiary};
        }
        .ant-radio .ant-radio-inner {
          border-color: ${theme.colorTextTertiary};
        }
        .ant-switch {
          background-color: ${theme.colorTextTertiary};
        }

        /* WCAG 1.4.11: Divider/separator contrast — colorSplit (~#f0f0f0) is ~1.04:1 on white.
           Override to colorTextTertiary (~3.54:1). */
        .ant-divider {
          border-color: ${theme.colorTextTertiary};
        }

        /* WCAG 1.4.11: Table borders and progress bars */
        .ant-table-bordered .ant-table-cell {
          border-color: ${theme.colorTextQuaternary};
        }
        .ant-progress-bg {
          min-width: 2px;
        }

        /* WCAG 2.4.7: Focus Visible — ensure all interactive elements have a visible
           keyboard focus indicator. Uses :focus-visible to avoid showing on mouse clicks.
           Uses !important to override Ant Design CSS-in-JS rules that generate a
           lighter focus color (~1.70:1) with higher specificity. */
        *:focus-visible {
          outline: 2px solid ${theme.colorPrimary} !important;
          outline-offset: 2px !important;
        }

        /* WCAG 1.4.3: Minimum Contrast — override link color from colorPrimary (#2893B3,
           3.55:1 on white) to a darker shade that meets the 4.5:1 text contrast threshold. */
        a {
          color: #0d7090;
        }
        a:hover {
          color: #0a5a73;
        }

        /* Screen-reader-only utility class for visually hidden but accessible content
           (WCAG 2.4.6: headings that provide document structure without visual noise) */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}
    />
  );
};
