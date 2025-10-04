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
    color: ${theme.colorBgBase};
    background: ${theme.colorText};
    border-radius: 1em;
    vertical-align: text-top;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    min-width: 1em;
    min-height: 1em;
    line-height: 1em;
    vertical-align: middle;
    white-space: nowrap;

    svg {
      position: relative;
      color: ${theme.colorBgBase};
      width: 1em;
      height: 1em;
      display: inline-block;
      vertical-align: middle;
    }

    &:hover {
      cursor: pointer;
      background: ${theme.colorText};
    }

    &.has-cross-filters {
      background: ${theme.colorPrimary};
      &:hover {
        background: ${theme.colorPrimaryText};
      }
    }
  `}
`;

export const SectionName = styled.span`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
  `}
`;
export const FilterName = styled.span`
  ${({ theme }) => css`
    padding-right: ${theme.sizeUnit}px;
    font-style: italic;
    & > * {
      margin-right: ${theme.sizeUnit}px;
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
    color: inherit;

    &::-moz-focus-inner {
      border: 0;
    }

    & i svg {
      opacity: 35%;
      margin-right: ${theme.sizeUnit}px;
      transition: opacity ease-in-out ${theme.motionDurationMid};
    }

    &:hover i svg,
    &:focus-visible i svg {
      opacity: 1;
    }
  `}
`;

export const FiltersContainer = styled.div`
  ${({ theme }) => css`
    max-height: 60vh;
    margin-top: ${theme.sizeUnit}px;
    &:not(:last-child) {
      padding-bottom: ${theme.sizeUnit * 3}px;
    }
  `}
`;

export const FiltersDetailsContainer = styled.div`
  ${({ theme }) => css`
    min-width: 200px;
    max-width: 300px;
    overflow-x: hidden;

    color: ${theme.colorText};
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
    background-color: ${theme.colorBorderSecondary};
    margin: ${theme.sizeUnit * 4}px 0;
  `}
`;
