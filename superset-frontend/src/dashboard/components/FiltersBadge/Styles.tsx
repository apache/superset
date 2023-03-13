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

export const Pill = styled.div`
  ${({ theme }) => css`
    display: flex;
    color: ${theme.colors.grayscale.light5};
    background: ${theme.colors.grayscale.base};
    border-radius: 1em;
    vertical-align: text-top;
    padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
    font-size: ${theme.typography.sizes.m}px;
    font-weight: ${theme.typography.weights.bold};
    min-width: 1em;
    min-height: 1em;
    line-height: 1em;
    vertical-align: middle;
    white-space: nowrap;

    svg {
      position: relative;
      color: ${theme.colors.grayscale.light5};
      width: 1em;
      height: 1em;
      display: inline-block;
      vertical-align: middle;
    }

    &:hover {
      cursor: pointer;
      background: ${theme.colors.grayscale.dark1};
    }

    &.has-cross-filters {
      background: ${theme.colors.primary.base};
      &:hover {
        background: ${theme.colors.primary.dark1};
      }
    }
  `}
`;

export const SectionName = styled.span`
  ${({ theme }) => css`
    font-weight: ${theme.typography.weights.bold};
  `}
`;
export const FilterName = styled.span`
  ${({ theme }) => css`
    padding-right: ${theme.gridUnit}px;
    font-style: italic;
    & > * {
      margin-right: ${theme.gridUnit}px;
    }
  `}
`;

export const FilterItem = styled.button`
  ${({ theme }) => css`
    cursor: pointer;
    display: flex;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    outline: none;
    width: 100%;

    &::-moz-focus-inner {
      border: 0;
    }

    & i svg {
      opacity: ${theme.opacity.mediumLight};
      margin-right: ${theme.gridUnit}px;
      transition: opacity ease-in-out ${theme.transitionTiming};
    }

    &:hover i svg {
      opacity: 1;
    }
  `}
`;

export const FiltersContainer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit}px;
    &:not(:last-child) {
      padding-bottom: ${theme.gridUnit * 3}px;
    }
  `}
`;

export const FiltersDetailsContainer = styled.div`
  ${({ theme }) => css`
    min-width: 200px;
    max-width: 300px;
    overflow-x: hidden;

    color: ${theme.colors.grayscale.light5};
  `}
`;

export const FilterValue = styled.span`
  max-width: 100%;
  flex-grow: 1;
  overflow: auto;
`;

export const Separator = styled.div`
  ${({ theme }) => css`
    width: 100%;
    height: 1px;
    background-color: ${theme.colors.grayscale.light1};
    margin: ${theme.gridUnit * 4}px 0;
  `}
`;
