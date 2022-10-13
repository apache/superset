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

export const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    margin: ${theme.gridUnit}px 0;
    font-size: ${theme.typography.sizes.s}px;

    &:first-of-type {
      margin-top: 0;
    }

    &:last-of-type {
      margin-bottom: 0;
    }

    & .ant-tooltip-open {
      display: inline-flex;
    }
  `};
`;

export const RowLabel = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.base};
    padding-right: ${theme.gridUnit * 4}px;
    margin-right: auto;
    text-transform: uppercase;
    white-space: nowrap;
  `};
`;

export const RowValue = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline;
  `};
`;

export const FilterName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const DependencyItem = styled.span`
  text-decoration: underline;
  cursor: pointer;
`;

export const RowTruncationCount = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.primary.base};
  `}
`;

export const TooltipList = styled.ul`
  ${({ theme }) => css`
    padding-left: ${theme.gridUnit * 3}px;
    margin-bottom: 0;
  `};
`;

export const TooltipSectionLabel = styled.span`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

export const TooltipTrigger = styled.div`
  min-width: 0;
  display: inline-flex;
  white-space: nowrap;
`;
