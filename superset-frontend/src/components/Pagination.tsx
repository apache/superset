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
import React, { PureComponent } from 'react';
import cx from 'classnames';
import styled from '@superset-ui/style';

interface PaginationButton {
  disabled?: boolean;
  onClick: React.EventHandler<React.SyntheticEvent<HTMLElement>>;
}

interface PaginationItemButton extends PaginationButton {
  active: boolean;
  children: React.ReactNode;
}

function Prev({ disabled, onClick }: PaginationButton) {
  return (
    <li className={cx({ disabled })}>
      <span role="button" tabIndex={disabled ? -1 : 0} onClick={onClick}>
        «
      </span>
    </li>
  );
}

function Next({ disabled, onClick }: PaginationButton) {
  return (
    <li className={cx({ disabled })}>
      <span role="button" tabIndex={disabled ? -1 : 0} onClick={onClick}>
        »
      </span>
    </li>
  );
}

function Item({ active, children, onClick }: PaginationItemButton) {
  return (
    <li className={cx({ active })}>
      <span role="button" tabIndex={active ? -1 : 0} onClick={onClick}>
        {children}
      </span>
    </li>
  );
}

function Ellipsis({ disabled, onClick }: PaginationButton) {
  return (
    <li className={cx({ disabled })}>
      <span role="button" tabIndex={disabled ? -1 : 0} onClick={onClick}>
        …
      </span>
    </li>
  );
}

interface PaginationProps {
  children: React.ReactNode;
}

const PaginationList = styled.ul`
  display: inline-block;
  margin: 16px 0;

  li {
    display: inline;
    margin: 0 4px;

    span {
      padding: 8px 12px;
      text-decoration: none;
      background-color: ${({ theme }) => theme.colors.grayscale.light5};
      border-radius: ${({ theme }) => theme.borderRadius}px;

      &:hover,
      &:focus {
        z-index: 2;
        color: ${({ theme }) => theme.colors.grayscale.dark1};
        background-color: ${({ theme }) => theme.colors.grayscale.light3};
      }
    }

    &.disabled {
      span {
        background-color: transparent;
        cursor: default;

        &:focus {
          outline: none;
        }
      }
    }
    &.active {
      span {
        z-index: 3;
        color: ${({ theme }) => theme.colors.grayscale.light5};
        cursor: default;
        background-color: ${({ theme }) => theme.colors.primary.base};

        &:focus {
          outline: none;
        }
      }
    }
  }
`;

export default class Pagination extends PureComponent<PaginationProps> {
  static Next = Next;
  static Prev = Prev;
  static Item = Item;
  static Ellipsis = Ellipsis;
  render() {
    return <PaginationList> {this.props.children}</PaginationList>;
  }
}
