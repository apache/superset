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
import { ReactNode } from 'react';
import { css, SupersetTheme } from '@superset-ui/core';
import { Collapse as AntdCollapse } from 'antd';
import { CollapsePanelProps } from 'antd/lib/collapse';

const anticonHeight = 12;
const antdPanelStyles = (theme: SupersetTheme) => css`
  .ant-collapse-header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: 0px ${theme.sizeUnit * 4}px;

    .anticon.anticon-right.ant-collapse-arrow {
      padding: 0;
      top: calc(50% - ${anticonHeight / 2}px);
    }

    .collapse-panel-title {
      font-size: ${theme.sizeUnit * 4}px;
      font-weight: ${theme.fontWeightStrong};
      line-height: 130%;
    }

    .collapse-panel-subtitle {
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightNormal};
      line-height: 150%;
      margin-bottom: 0;
      padding-top: ${theme.sizeUnit}px;
    }

    .collapse-panel-asterisk {
      color: var(--semantic-error-base, ${theme.colors.warning.dark1});
    }
    .validation-checkmark {
      width: ${theme.sizeUnit * 4}px;
      height: ${theme.sizeUnit * 4}px;
      margin-left: ${theme.sizeUnit}px;
      color: ${theme.colorSuccess};
    }
  }
`;

export interface PanelProps extends CollapsePanelProps {
  children?: ReactNode;
}
const StyledPanel = (props: PanelProps) => (
  <AntdCollapse.Panel
    css={(theme: SupersetTheme) => antdPanelStyles(theme)}
    {...props}
  />
);

export default StyledPanel;
