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

export const Pill = styled.div`
  display: inline-block;
  background: ${({ theme }) => theme.colors.grayscale.base};
  color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: 1em;
  vertical-align: text-top;
  padding: ${({ theme }) => `${theme.gridUnit}px ${theme.gridUnit * 2}px`};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  font-weight: bold;
  min-width: 1em;
  min-height: 1em;
  line-height: 1em;
  vertical-align: middle;
  white-space: nowrap;

  svg {
    position: relative;
    top: -1px;
  }

  &:hover {
    cursor: pointer;
    background: ${({ theme }) => theme.colors.grayscale.dark1};
  }

  &.has-incompatible-filters {
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    background: ${({ theme }) => theme.colors.alert.base};
    &:hover {
      background: ${({ theme }) => theme.colors.alert.dark1};
    }
  }

  &.filters-inactive {
    color: ${({ theme }) => theme.colors.grayscale.light5};
    background: ${({ theme }) => theme.colors.grayscale.light1};
    padding: ${({ theme }) => theme.gridUnit}px;
    text-align: center;
    height: 22px;
    width: 22px;

    &:hover {
      background: ${({ theme }) => theme.colors.grayscale.base};
    }
  }
`;

export const WarningPill = styled(Pill)`
  background: ${({ theme }) => theme.colors.alert.base};
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

export const UnsetPill = styled(Pill)`
  background: ${({ theme }) => theme.colors.grayscale.light1};
`;

export interface TitleProps {
  bold?: boolean;
  color?: string;
}

export const Title = styled.span`
  color: ${({ color }: TitleProps) => color || 'auto'};
  font-weight: ${({ bold }) => (bold ? '600' : 'auto')};

  & > .anticon * {
    color: ${({ color }) => color || 'auto'};
  }
`;

export const Summary = styled.div`
  font-weight: bold;
`;

export const ItemIcon = styled.i`
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -20px;
`;

export const Item = styled.button`
  cursor: pointer;
  display: block;
  padding: 0;
  border: none;
  background: none;
  white-space: nowrap;
  position: relative;
  outline: none;

  &::-moz-focus-inner {
    border: 0;
  }

  &:hover > i {
    display: block;
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
  max-width: 400px;
  overflow-x: hidden;
`;
