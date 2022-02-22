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
import { css, styled } from '@superset-ui/core';

export const Styles = styled.div`
  ${({ theme }) => css`
    .filter-card-popover {
      width: 240px;
      padding: 0;
      border-radius: 4px;

      .ant-popover-inner-content {
        padding: ${theme.gridUnit * 4}px;
      }

      .ant-popover-arrow {
        display: none;
      }
    }
  `}
`;

export const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    margin: ${theme.gridUnit}px 0;
    font-size: ${theme.typography.sizes.s}px;
  `};
`;

export const RowLabel = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.base};
    padding-right: ${theme.gridUnit * 4}px;
    margin-right: auto;
    text-transform: uppercase;
  `};
`;

export const RowValue = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.s}px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `};
`;

export const RowTruncationCount = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.primary.base};
  `}
`;
