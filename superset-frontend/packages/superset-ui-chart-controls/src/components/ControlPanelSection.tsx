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
import React, { useState } from 'react';
import { styled } from '@superset-ui/core';
import { Collapse } from '@superset-ui/core/components';

const { Panel } = Collapse;

const StyledCollapse = styled(Collapse)`
  margin-bottom: ${({ theme }: any) => theme.gridUnit * 3}px;
  border: none;
  background: transparent;

  .ant-collapse-item {
    border: 1px solid ${({ theme }: any) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }: any) => theme.borderRadius}px;
    margin-bottom: ${({ theme }: any) => theme.gridUnit * 2}px;

    .ant-collapse-header {
      font-weight: ${({ theme }: any) => theme.typography.weights.bold};
      background: ${({ theme }: any) => theme.colors.grayscale.light5};
      border-radius: ${({ theme }: any) => theme.borderRadius}px
        ${({ theme }: any) => theme.borderRadius}px 0 0;
    }

    .ant-collapse-content {
      background: white;
      padding: ${({ theme }: any) => theme.gridUnit * 3}px;
    }
  }
`;

export interface ControlPanelSectionProps {
  title: string;
  children: React.ReactNode;
  expanded?: boolean;
}

export const ControlPanelSection: React.FC<ControlPanelSectionProps> = ({
  title,
  children,
  expanded = false,
}) => {
  const [activeKey, setActiveKey] = useState(expanded ? ['1'] : []);

  return (
    <StyledCollapse
      activeKey={activeKey}
      onChange={keys => setActiveKey(keys as string[])}
    >
      <Panel header={title} key="1">
        {children}
      </Panel>
    </StyledCollapse>
  );
};
