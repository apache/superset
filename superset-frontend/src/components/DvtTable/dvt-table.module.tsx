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

const StyledTable = styled.div`
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  .ant-checkbox-indeterminate .ant-checkbox-inner::after {
    display: inline-flex;
    width: 15px;
    height: 15px;
    background-color: ${({ theme }) => theme.colors.dvt.primary.base};
    transform: translate(-50%, -50%) scale(1);
  }

  .ant-checkbox-checked .ant-checkbox-inner {
    position: relative;
    background-color: ${({ theme }) => theme.colors.dvt.primary.base};
    border-color: ${({ theme }) => theme.colors.dvt.primary.base};
    height: 24px;
    width: 24px;
  }

  .ant-checkbox-checked .ant-checkbox-inner::after {
    display: inline-flex;
    top: 50%;
    left: calc(50% - 4.5px);
    width: 6px;
    height: 11px;
  }

  .ant-checkbox-inner {
    height: 24px;
    width: 24px;
  }
`;

const StyledTableTable = styled.table`
  height: 100%;
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 20px;
`;

const StyledTabletHead = styled.thead``;

const StyledTableIcon = styled.div`
  display: flex;
`;

const StyledTableTr = styled.tr`
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  height: 56px;
  margin-bottom: 20px;
  cursor: pointer;
  &:hover {
    background-color: ${({ theme }) => theme.colors.dvt.primary.light2};
  }
`;

const StyledTableTitle = styled.tr``;

interface StyledTableThProps {
  flex: number;
}

const StyledTableTh = styled.th<StyledTableThProps>`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-size: 16px;
  font-weight: 600;
  padding-bottom: 28px;
  padding-left: 3px;
  width: ${({ flex }) => (flex ? `${flex}%` : 'auto')};
  &:first-of-type {
    padding-left: 30px;
    padding-right: 3px;
  }
`;

const StyledTableTbody = styled.tbody``;

interface StyledTableTdProps {
  $onLink: boolean;
}

const StyledTableTd = styled.td<StyledTableTdProps>`
  color: ${({ $onLink, theme }) =>
    $onLink ? theme.colors.dvt.primary.base : theme.colors.grayscale.dark2};
  font-size: 14px;
  font-weight: 400;
  &:first-of-type {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    padding-left: 30px;
  }
  &:last-of-type {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }
`;

const StyledTablePagination = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-right: 13px;
  padding-top: 55px;
`;

const StyledTableCheckbox = styled.div`
  display: inline-flex;
  margin-right: 24px;
`;

export {
  StyledTable,
  StyledTableTable,
  StyledTabletHead,
  StyledTableTr,
  StyledTableTh,
  StyledTableTbody,
  StyledTableTd,
  StyledTablePagination,
  StyledTableTitle,
  StyledTableIcon,
  StyledTableCheckbox,
};
