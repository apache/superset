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

interface StyledDvtContentListUlProps {
  $column?: boolean;
}

interface StyledDvtContentListLiProps {
  $lastOnWidth?: boolean;
}

const StyledDvtContent = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  width: 743px;
  height: 451px;
  padding: 24px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const StyledDvtContentTitle = styled.div`
  display: flex;
  font-size: 16px;
  font-weight: 700;
  line-height: 150%;
  margin-bottom: 24px;
  letter-spacing: 0.2px;
  color: ${({ theme }) => theme.colors.dvt.text.bold};
`;

const StyledDvtContentHeader = styled.div`
  display: flex;
  width: 695px;
  height: 51px;
  align-items: center;
  padding: 24px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
`;

const StyledDvtContentSubtitleP = styled.div`
  font-size: 12px;
  flex: 1;
  font-weight: 500;
  line-height: 160%;
  color: ${({ theme }) => theme.colors.dvt.text.help};
`;

const StyledDvtContentScroll = styled.div`
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

const StyledDvtContentList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 24px;
  width: 695px;
  height: 300px;
`;

const StyledDvtContentListUl = styled.ul<StyledDvtContentListUlProps>`
  display: flex;
  flex: 1;
  gap: 10px;
  list-style: none;
  ${({ $column }) => $column && `flex-direction:column`};
  margin: 0;
  padding: 0;
`;

const StyledContentListLi = styled.li<StyledDvtContentListLiProps>`
  display: flex;
  flex: 1;
  align-items: center;
  ${({ $lastOnWidth }) =>
    $lastOnWidth &&
    `&:last-of-type {
    background-color: red;
  }`};
`;

export {
  StyledDvtContent,
  StyledDvtContentTitle,
  StyledDvtContentHeader,
  StyledDvtContentScroll,
  StyledDvtContentSubtitleP,
  StyledDvtContentListUl,
  StyledContentListLi,
  StyledDvtContentList,
};
