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

const StyledDvtList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 11px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  height: 734px;
`;

const StyledDvtListLabel = styled.div`
  display: flex;
  letter-spacing: 0.2px;
  font-weight: bold;
  font-size: 12px;
  padding-top: 10px;
  line-height: 14.63px;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;

const StyledDvtListScroll = styled.div`
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  
  &::-webkit-scrollbar {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.light1};
    width: 6px;
    border-radius: 12px;

  }
  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.base};
    width: 4px;
    border-radius: 12px;
  }
`;

const StyledDvtListItem = styled.div`
  display: flex;
  justify-content: space-between;
  margin-right: 8px;
`;

export {
  StyledDvtList,
  StyledDvtListLabel,
  StyledDvtListScroll,
  StyledDvtListItem,
};
