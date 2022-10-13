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
    display: inline-block;
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
      top: -2px;
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

    &.has-incompatible-filters {
      color: ${theme.colors.grayscale.dark2};
      background: ${theme.colors.alert.base};
      &:hover {
        background: ${theme.colors.alert.dark1};
      }
      svg {
        color: ${theme.colors.grayscale.dark2};
      }
    }

    &.filters-inactive {
      color: ${theme.colors.grayscale.light5};
      background: ${theme.colors.grayscale.light1};
      padding: ${theme.gridUnit}px;
      text-align: center;
      height: 22px;
      width: 22px;

      &:hover {
        background: ${theme.colors.grayscale.base};
      }
    }
  `}
`;

export interface TitleProps {
  bold?: boolean;
  color?: string;
}

export const Title = styled.span<TitleProps>`
  position: relative;
  margin-right: ${({ theme }) => theme.gridUnit}px;
  font-weight: ${({ bold, theme }) => {
    if (bold) return theme.typography.weights.bold;
    return 'auto';
  }};
  color: ${({ color, theme }) => color || theme.colors.grayscale.light5};
  display: flex;
  align-items: center;
  & > * {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

export const ItemIcon = styled.i`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -${({ theme }) => theme.gridUnit * 5}px;
`;

export const Item = styled.button`
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
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
    color: transparent;
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }

  &:hover i svg {
    color: inherit;
  }
`;

export const Reset = styled.div`
  margin: 0 -${({ theme }) => theme.gridUnit * 4}px;
`;

export const Indent = styled.div`
  padding-left: ${({ theme }) => theme.gridUnit * 6}px;
  margin: -${({ theme }) => theme.gridUnit * 3}px 0;
`;

export const Panel = styled.div`
  min-width: 200px;
  max-width: 300px;
  overflow-x: hidden;
`;

export const FilterValue = styled.div`
  max-width: 100%;
  flex-grow: 1;
  overflow: auto;
  color: ${({ theme }) => theme.colors.grayscale.light5};
`;

export const FilterIndicatorText = styled.div`
  ${({ theme }) => `
  padding-top: ${theme.gridUnit * 3}px;
  max-width: 100%;
  flex-grow: 1;
  overflow: auto;
  color: ${theme.colors.grayscale.light5};
  `}
`;
