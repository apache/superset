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
import { DownOutlined } from '@ant-design/icons';
import Link from '@docusaurus/Link';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import styled from '@emotion/styled';
import { mq } from '../utils.js';

const getStartedMenuItems: MenuProps['items'] = [
  { key: 'users', label: <Link to="/user-docs/">Users</Link> },
  { key: 'admins', label: <Link to="/admin-docs/">Admins</Link> },
  { key: 'developers', label: <Link to="/developer-docs/">Developers</Link> },
];

const Root = styled.div<{ $variant: 'hero' | 'navbar' }>`
  display: flex;
  align-items: stretch;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  z-index: 2;
  font-weight: bold;

  ${({ $variant }) =>
    $variant === 'hero'
      ? `
    width: 208px;
    margin: 15px auto 0;
    font-size: 20px;
    ${mq[1]} {
      font-size: 19px;
      width: 214px;
    }
  `
      : `
    width: 176px;
    margin-right: 20px;
    font-size: 18px;
  `}

  .split-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    text-decoration: none;
    min-width: 0;
    ${({ $variant }) =>
      $variant === 'hero'
        ? `padding: 10px 10px;`
        : `padding: 7px 8px;`}
  }

  .split-main:hover {
    color: #ffffff;
  }

  .split-divider {
    width: 1px;
    flex-shrink: 0;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.38);
    ${({ $variant }) =>
      $variant === 'hero'
        ? `margin: 8px 0;`
        : `margin: 6px 0;`}
  }

  .split-dropdown-trigger {
    flex-shrink: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #ffffff;
    ${({ $variant }) =>
      $variant === 'hero'
        ? `
      width: 44px;
      font-size: 11px;
      ${mq[1]} {
        width: 46px;
      }
    `
        : `
      width: 38px;
      font-size: 10px;
    `}
  }

  .split-dropdown-trigger:hover {
    color: #ffffff;
  }
`;

export type GetStartedSplitButtonProps = {
  variant: 'hero' | 'navbar';
  /** Classes for the outer control (include default-button-theme get-started-split) */
  rootClassName: string;
};

export default function GetStartedSplitButton({
  variant,
  rootClassName,
}: GetStartedSplitButtonProps) {
  const menuClassName = `get-started-split-dropdown-menu get-started-split-dropdown-menu--${variant}`;

  return (
    <Root $variant={variant} className={rootClassName}>
      <Link to="/user-docs/" className="split-main">
        Get Started
      </Link>
      <span className="split-divider" aria-hidden />
      <Dropdown
        menu={{
          items: getStartedMenuItems,
          className: menuClassName,
        }}
        trigger={['click']}
        placement="bottomRight"
      >
        <button
          type="button"
          className="split-dropdown-trigger"
          aria-haspopup="menu"
          aria-label="Choose documentation: Users, Admins, or Developers"
        >
          <DownOutlined />
        </button>
      </Dropdown>
    </Root>
  );
}
