/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy` of the License at
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
import { css, SupersetTheme } from '@apache-superset/core/theme';

export const fullscreenStyles = (theme: SupersetTheme) => css`
  /* Using && to increase specificity without needing !important as often */
  [data-test='dashboard-component-chart-holder']:fullscreen {
    background-color: ${theme.colorBgBase};
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: ${theme.sizeUnit * 4}px;
    overflow: visible;
    position: relative;
    pointer-events: auto;
    z-index: 1000;
    opacity: 1;
    visibility: visible;

    /* Ensure children take up available space */
    .dashboard-chart,
    .chart-container,
    .slice_container,
    .chart-slice {
      flex: 1 1 auto;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      overflow: visible;
    }

    /* Portaled components inside the fullscreen layer */
    .ant-dropdown,
    .ant-tooltip,
    .ant-modal-root,
    .ant-select-dropdown,
    .ant-popover {
      z-index: 99999;
      pointer-events: auto;
    }
  }

  /* Interaction and Header fixes */
  [data-test='dashboard-component-chart-holder']:fullscreen * {
    pointer-events: auto;
  }

  [data-test='dashboard-component-chart-header'] {
    z-index: 100;
    position: relative;
  }
`;
