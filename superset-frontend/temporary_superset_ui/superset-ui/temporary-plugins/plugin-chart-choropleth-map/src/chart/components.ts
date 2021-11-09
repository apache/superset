/*
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

/// <reference types="@superset-ui/core/node_modules/@emotion/styled" />
import { styled, supersetTheme } from '@superset-ui/core';

export const PADDING = supersetTheme.gridUnit * 4;

export const RelativeDiv = styled.div`
  position: relative;
`;

export const ZoomControls = styled.div`
  position: absolute;
  top: ${PADDING}px;
  right: ${PADDING}px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

export const MiniMapControl = styled.div`
  position: absolute;
  bottom: ${PADDING + 6}px;
  right: ${PADDING + 1}px;
`;

export const IconButton = styled.button`
  width: ${({ theme }) => theme.gridUnit * 6}px;
  font-size: ${({ theme }) => theme.typography.sizes.xl}px;
  text-align: center;
  color: #222;
  margin: 0px;
  margin-bottom: 2px;
  background: #f5f8fb;
  padding: 0px ${({ theme }) => theme.gridUnit}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
`;

export const TextButton = styled.button`
  text-align: center;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: #222;
  margin: 0px;
  background: #f5f8fb;
  padding: ${({ theme }) => theme.gridUnit / 2}px
    ${({ theme }) => theme.gridUnit * 1.5}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
`;
