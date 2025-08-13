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
import React from 'react';
import { styled } from '@superset-ui/core';

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }: any) => theme.gridUnit * 3}px;
  margin-bottom: ${({ theme }: any) => theme.gridUnit * 3}px;

  & > * {
    flex: 1;
  }

  .control-wrapper {
    min-width: 0; // Allow flex items to shrink
  }
`;

export interface ControlRowProps {
  children: React.ReactNode;
}

export const ControlRow: React.FC<ControlRowProps> = ({ children }) => (
  <StyledRow>{children}</StyledRow>
);
