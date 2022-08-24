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
import { styled } from '@superset-ui/core';

export const StyledLayoutWrapper = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const Column = styled.div`
  width: 100%;
  height: 100%;
  flex-direction: column;
`;

export const LeftColumn = styled(Column)`
  width: ${({ theme }) => theme.gridUnit * 80}px;
  height: auto;
`;

export const RightColumn = styled(Column)`
  height: auto;
  display: flex;
  flex: 1 0 auto;
  width: auto;
`;

const Row = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
`;

export const OuterRow = styled(Row)`
  flex: 1 0 auto;
`;

export const PanelRow = styled(Row)`
  flex: 1 0 auto;
  height: auto;
`;

export const FooterRow = styled(Row)`
  flex: 0 0 auto;
  height: ${({ theme }) => theme.gridUnit * 16}px;
`;

export const StyledHeader = styled.div`
  flex: 0 0 auto;
  height: ${({ theme }) => theme.gridUnit * 16}px;
  border-bottom: 2px solid ${({ theme }) => theme.colors.grayscale.light2};

  .header-with-actions {
    height: ${({ theme }) => theme.gridUnit * 15.5}px;
  }
`;

export const StyledLeftPanel = styled.div`
  width: ${({ theme }) => theme.gridUnit * 80}px;
  height: 100%;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

export const StyledDatasetPanel = styled.div`
  width: 100%;
`;

export const StyledRightPanel = styled.div`
  border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  color: ${({ theme }) => theme.colors.success.base};
`;

export const StyledFooter = styled.div`
  height: ${({ theme }) => theme.gridUnit * 16}px;
  width: 100%;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  color: ${({ theme }) => theme.colors.info.base};
`;
