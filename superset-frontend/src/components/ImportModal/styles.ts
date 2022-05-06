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

export const antdWarningAlertStyles = (theme: SupersetTheme) => css`
  border: 1px solid ${theme.colors.warning.light1};
  padding: ${theme.gridUnit * 4}px;
  margin: ${theme.gridUnit * 4}px 0;
  color: ${theme.colors.warning.dark2};

  .ant-alert-message {
    margin: 0;
  }

  .ant-alert-description {
    font-size: ${theme.typography.sizes.s + 1}px;
    line-height: ${theme.gridUnit * 4}px;

    .ant-alert-icon {
      margin-right: ${theme.gridUnit * 2.5}px;
      font-size: ${theme.typography.sizes.l + 1}px;
      position: relative;
      top: ${theme.gridUnit / 4}px;
    }
  }
`;
