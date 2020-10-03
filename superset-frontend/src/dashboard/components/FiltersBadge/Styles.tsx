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

const Pill = styled.div`
  display: inline-block;
  background: ${({ theme }) => theme.colors.grayscale.dark1};
  color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: 1em;
  vertical-align: text-top;
  padding: 0 8px;
  font-size: 14px;
  font-weight: normal;
  transition: ${({ theme }) => theme.transitionTiming}s all;

  svg {
    vertical-align: middle;
    height: ${({ theme }) => theme.typography.sizes.m}px;
    width: ${({ theme }) => theme.typography.sizes.m}px;
    color: currentColor;
  }

  &:hover {
    cursor: pointer;
    background: ${({ theme }) => theme.colors.grayscale.dark2};
  }

  &.has-incompatible-filters {
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    background: ${({ theme }) => theme.colors.alert.base};
    &:hover {
      background: ${({ theme }) => theme.colors.alert.dark1};
    }
  }
`;

interface TitleProps {
  bold?: boolean;
  color?: string;
}

const Title = styled.span`
  color: ${({ color }: TitleProps) => color || 'auto'};
  font-weight: ${({ bold }) => (bold ? '600' : 'auto')};

  & > .anticon * {
    color: ${({ color }) => color || 'auto'};
  }
`;

const ItemIcon = styled.i`
  display: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -20px;
`;

const Item = styled.button`
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

const Reset = styled.div`
  margin: 0 -16px;
`;

const Indent = styled.div`
  padding-left: 24px;
  margin: -12px 0;
`;

const Panel = styled.div`
  min-width: 200px;
  max-width: 400px;
  overflow-x: hidden;
`;

const S = {
  Pill,
  Title,
  Reset,
  Indent,
  Panel,
  Item,
  ItemIcon,
};

export default S;
