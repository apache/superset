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
import { css } from '@superset-ui/core';
import { Global } from '@emotion/react';
import 'react-js-cron/dist/styles.css';

export const GlobalStyles = () => (
  <Global
    styles={theme => css`
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
      // CSS hack to resolve the issue caused by the invisible echart tooltip on
      // https://github.com/apache/superset/issues/30058
      .echarts-tooltip[style*='visibility: hidden'] {
        display: none !important;
      }

      // Ant Design is applying inline z-index styles causing troubles
      // TODO: Remove z-indexes when Ant Design is fully upgraded to v5
      // Prefer vanilla Ant Design z-indexes that should work out of the box
      .antd5-dropdown,
      .ant-dropdown,
      .ant-select-dropdown,
      .antd5-modal-wrap,
      .antd5-modal-mask,
      .antd5-picker-dropdown,
      .ant-popover,
      .antd5-popover {
        z-index: ${theme.zIndexPopupBase} !important;
      }

      // TODO: Remove when buttons have been upgraded to Ant Design 5.
      // Check src/components/Modal for more info.
      .column-config-popover {
        & .antd5-input-number {
          width: 100%;
        }
        && .btn-group svg {
          line-height: 0;
          top: 0;
        }
        & .btn-group > .btn {
          padding: 5px 10px 6px;
        }
        && .ant-tabs {
          margin-top: ${theme.sizeUnit * -3}px;
        }
        & .ant-tabs-nav {
          margin-left: ${theme.sizeUnit * -4}px;
          margin-right: ${theme.sizeUnit * -4}px;
          margin-bottom: ${theme.sizeUnit * 2}px;
        }
        && .ant-tabs-tab {
          flex: 1;
          margin-right: 0;
        }
      }
    `}
  />
);
